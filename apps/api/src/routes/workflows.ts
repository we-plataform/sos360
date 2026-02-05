import { Router } from 'express';
import { prisma } from '@lia360/database';
import { authenticate, authorize } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

export const workflowsRouter = Router();

// Schemas defined inline to avoid module resolution issues with tsx
const workflowStatusSchema = z.enum(['draft', 'active', 'paused', 'archived']);

const nodeTypeSchema = z.enum([
  'trigger_lead_stage_entry',
  'trigger_lead_score_change',
  'trigger_lead_field_change',
  'trigger_time_based',
  'trigger_webhook',
  'trigger_manual',
  'action_send_message',
  'action_add_tag',
  'action_remove_tag',
  'action_assign_user',
  'action_change_stage',
  'action_update_lead_field',
  'action_enqueue_agent',
  'action_send_webhook',
  'action_add_to_audience',
  'action_remove_from_audience',
  'action_wait_until_time',
  'action_increment_score',
  'action_decrement_score',
  'condition',
  'delay',
  'loop',
  'end'
]);

const nodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const workflowNodeConfigSchema = z.object({
  pipelineStageId: z.string().optional(),
  scoreThreshold: z.number().optional(),
  fieldName: z.string().optional(),
  fieldValue: z.any().optional(),
  scheduledTime: z.string().optional(),
  webhookUrl: z.string().url().optional(),
  webhookSecret: z.string().optional(),
  template: z.string().optional(),
  tag: z.string().optional(),
  assignedUserId: z.string().optional(),
  targetStageId: z.string().optional(),
  leadFieldData: z.record(z.any()).optional(),
  agentTask: z.string().optional(),
  audienceId: z.string().optional(),
  waitUntil: z.string().optional(),
  scoreIncrement: z.number().int().optional(),
  conditionField: z.string().optional(),
  conditionOperator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains', 'is_empty', 'is_not_empty']).optional(),
  conditionValue: z.any().optional(),
  delaySeconds: z.number().int().min(0).max(86400).optional(),
  delayUntil: z.string().optional(),
  loopType: z.enum(['leads', 'audience', 'custom_list']).optional(),
  loopList: z.array(z.string()).optional(),
  maxIterations: z.number().int().min(1).max(1000).optional(),
}).passthrough();

const createWorkflowNodeSchema = z.object({
  type: nodeTypeSchema,
  config: workflowNodeConfigSchema.optional(),
  position: nodePositionSchema.optional(),
});

const updateWorkflowNodeSchema = z.object({
  id: z.string().min(1),
  config: workflowNodeConfigSchema.optional(),
  position: nodePositionSchema.optional(),
});

const workflowEdgeConfigSchema = z.object({
  condition: z.enum(['true', 'false']).optional(),
  label: z.string().optional(),
}).passthrough();

const createWorkflowEdgeSchema = z.object({
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  config: workflowEdgeConfigSchema.optional(),
});

const updateWorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  config: workflowEdgeConfigSchema.optional(),
});

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  nodes: z.array(createWorkflowNodeSchema).optional(),
  edges: z.array(createWorkflowEdgeSchema).optional(),
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  status: workflowStatusSchema.optional(),
  nodes: z.array(updateWorkflowNodeSchema).optional(),
  edges: z.array(updateWorkflowEdgeSchema).optional(),
});

const cloneWorkflowSchema = z.object({
  targetWorkspaceId: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
});

// All routes require authentication
workflowsRouter.use(authenticate);

// POST /workflows - Create Workflow
workflowsRouter.post(
  '/',
  authorize('owner', 'admin', 'manager'),
  validate(createWorkflowSchema),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { name, description, nodes, edges } = req.body;

      const workflow = await prisma.workflow.create({
        data: {
          name,
          description,
          workspaceId,
          createdById: req.user!.id,
          status: 'draft',
          nodes: nodes
            ? {
                create: nodes.map((node: any) => ({
                  type: node.type,
                  config: node.config || {},
                  position: node.position || { x: 0, y: 0 },
                })),
              }
            : undefined,
          edges: edges
            ? {
                create: edges.map((edge: any) => ({
                  sourceNodeId: edge.sourceNodeId,
                  targetNodeId: edge.targetNodeId,
                  config: edge.config || {},
                })),
              }
            : undefined,
        },
        include: {
          nodes: true,
          edges: true,
        },
      });

      res.status(201).json({
        success: true,
        data: workflow,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /workflows - List Workflows
workflowsRouter.get(
  '/',
  authorize('owner', 'admin', 'manager', 'agent', 'viewer'),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { status, isTemplate, search, sort } = req.query;

      const where: any = {
        workspaceId,
      };

      if (status) {
        where.status = status;
      }

      if (isTemplate !== undefined) {
        where.isTemplate = isTemplate === 'true';
      }

      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const orderBy: any = {};
      if (sort === 'name') {
        orderBy.name = 'asc';
      } else if (sort === 'createdAt') {
        orderBy.createdAt = 'desc';
      } else {
        orderBy.updatedAt = 'desc';
      }

      const workflows = await prisma.workflow.findMany({
        where,
        orderBy,
        include: {
          nodes: {
            orderBy: { createdAt: 'asc' },
          },
          edges: true,
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: workflows,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /workflows/:id - Get Single Workflow
workflowsRouter.get(
  '/:id',
  authorize('owner', 'admin', 'manager', 'agent', 'viewer'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;

      const workflow = await prisma.workflow.findFirst({
        where: {
          id,
          workspaceId,
        },
        include: {
          nodes: {
            orderBy: { createdAt: 'asc' },
          },
          edges: true,
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
          testRuns: {
            take: 10,
            orderBy: { startedAt: 'desc' },
          },
        },
      });

      if (!workflow) {
        throw new NotFoundError('Workflow');
      }

      res.json({
        success: true,
        data: workflow,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /workflows/:id - Update Workflow
workflowsRouter.patch(
  '/:id',
  authorize('owner', 'admin', 'manager'),
  validate(updateWorkflowSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;
      const { name, description, status, nodes, edges } = req.body;

      // Verify workflow exists and belongs to workspace
      const existing = await prisma.workflow.findFirst({
        where: {
          id,
          workspaceId,
        },
      });

      if (!existing) {
        throw new NotFoundError('Workflow');
      }

      // Build update data
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (status !== undefined) updateData.status = status;

      const workflow = await prisma.workflow.update({
        where: { id },
        data: updateData,
        include: {
          nodes: true,
          edges: true,
        },
      });

      // Handle nodes update if provided
      if (nodes) {
        // Delete existing nodes
        await prisma.workflowNode.deleteMany({
          where: { workflowId: id },
        });

        // Create new nodes
        if (nodes.length > 0) {
          await prisma.workflowNode.createMany({
            data: nodes.map((node: any) => ({
              workflowId: id,
              type: node.type,
              config: node.config || {},
              position: node.position || { x: 0, y: 0 },
            })),
          });
        }

        // Refetch to include updated nodes
        const updatedWorkflow = await prisma.workflow.findUnique({
          where: { id },
          include: {
            nodes: {
              orderBy: { createdAt: 'asc' },
            },
            edges: true,
          },
        });

        return res.json({
          success: true,
          data: updatedWorkflow,
        });
      }

      // Handle edges update if provided
      if (edges) {
        // Delete existing edges
        await prisma.workflowEdge.deleteMany({
          where: { workflowId: id },
        });

        // Create new edges
        if (edges.length > 0) {
          await prisma.workflowEdge.createMany({
            data: edges.map((edge: any) => ({
              workflowId: id,
              sourceNodeId: edge.sourceNodeId,
              targetNodeId: edge.targetNodeId,
              config: edge.config || {},
            })),
          });
        }

        // Refetch to include updated edges
        const updatedWorkflow = await prisma.workflow.findUnique({
          where: { id },
          include: {
            nodes: {
              orderBy: { createdAt: 'asc' },
            },
            edges: true,
          },
        });

        return res.json({
          success: true,
          data: updatedWorkflow,
        });
      }

      res.json({
        success: true,
        data: workflow,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /workflows/:id - Delete Workflow
workflowsRouter.delete(
  '/:id',
  authorize('owner', 'admin', 'manager'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;

      // Verify workflow exists and belongs to workspace
      const existing = await prisma.workflow.findFirst({
        where: {
          id,
          workspaceId,
        },
      });

      if (!existing) {
        throw new NotFoundError('Workflow');
      }

      // Delete workflow (cascade will handle nodes and edges)
      await prisma.workflow.delete({
        where: { id },
      });

      res.json({
        success: true,
        data: {
          message: 'Workflow deleted successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /workflows/:id/clone - Clone Workflow to Another Workspace
workflowsRouter.post(
  '/:id/clone',
  authorize('owner', 'admin', 'manager'),
  validate(cloneWorkflowSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;
      const { targetWorkspaceId, name, description } = req.body;

      // Verify source workflow exists and belongs to current workspace
      const sourceWorkflow = await prisma.workflow.findFirst({
        where: {
          id,
          workspaceId,
        },
        include: {
          nodes: {
            orderBy: { createdAt: 'asc' },
          },
          edges: true,
        },
      });

      if (!sourceWorkflow) {
        throw new NotFoundError('Workflow');
      }

      // Verify user has access to target workspace
      // Check if user is a member of the target workspace
      const targetWorkspaceAccess = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: targetWorkspaceId,
          userId: req.user!.id,
        },
      });

      if (!targetWorkspaceAccess) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to the target workspace',
        });
      }

      // Check user's role in target workspace
      const hasPermission = ['owner', 'admin', 'manager'].includes(targetWorkspaceAccess.role);
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to create workflows in the target workspace',
        });
      }

      // Clone the workflow to target workspace
      const sourceNodes = sourceWorkflow.nodes as any[];
      const sourceEdges = sourceWorkflow.edges as any[];

      const clonedWorkflow = await prisma.workflow.create({
        data: {
          name: name || `${sourceWorkflow.name} (Copy)`,
          description: description || sourceWorkflow.description,
          workspaceId: targetWorkspaceId,
          createdById: req.user!.id,
          status: 'draft',
          nodes: sourceNodes.length > 0
            ? {
                create: sourceNodes.map((node) => ({
                  type: node.type,
                  config: node.config || {},
                  position: node.position || { x: 0, y: 0 },
                })),
              }
            : undefined,
          edges: sourceEdges.length > 0
            ? {
                create: sourceEdges.map((edge) => ({
                  sourceNodeId: edge.sourceNodeId,
                  targetNodeId: edge.targetNodeId,
                  config: edge.config || {},
                })),
              }
            : undefined,
        },
        include: {
          nodes: {
            orderBy: { createdAt: 'asc' },
          },
          edges: true,
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        data: clonedWorkflow,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /workflows/templates - List Workflow Templates
workflowsRouter.get(
  '/templates',
  authorize('owner', 'admin', 'manager', 'agent', 'viewer'),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { category, search } = req.query;

      // Get system templates (available to all) + workspace-specific templates
      const where: any = {
        OR: [
          { isSystem: true },
          { workspaceId },
        ],
      };

      if (category) {
        where.category = category;
      }

      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const templates = await prisma.workflowTemplate.findMany({
        where,
        orderBy: [
          { isSystem: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /workflows/templates/:id - Get Single Workflow Template
workflowsRouter.get(
  '/templates/:id',
  authorize('owner', 'admin', 'manager', 'agent', 'viewer'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;

      const template = await prisma.workflowTemplate.findFirst({
        where: {
          id,
          OR: [
            { isSystem: true },
            { workspaceId },
          ],
        },
        include: {
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      if (!template) {
        throw new NotFoundError('Workflow Template');
      }

      res.json({
        success: true,
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }
);

const createFromTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

// POST /workflows/templates/:id/instantiate - Create Workflow from Template
workflowsRouter.post(
  '/templates/:id/instantiate',
  authorize('owner', 'admin', 'manager'),
  validate(createFromTemplateSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;
      const { name, description } = req.body;

      // Verify template exists and is accessible
      const template = await prisma.workflowTemplate.findFirst({
        where: {
          id,
          OR: [
            { isSystem: true },
            { workspaceId },
          ],
        },
      });

      if (!template) {
        throw new NotFoundError('Workflow Template');
      }

      // Parse template nodes and edges
      const templateNodes = template.nodes as any[];
      const templateEdges = template.edges as any[];

      // Create workflow from template
      const workflow = await prisma.workflow.create({
        data: {
          name,
          description: description || template.description,
          workspaceId,
          createdById: req.user!.id,
          status: 'draft',
          nodes: {
            create: templateNodes.map((node: any) => ({
              type: node.type,
              config: node.config || {},
              position: node.position || { x: 0, y: 0 },
            })),
          },
          edges: {
            create: templateEdges.map((edge: any) => ({
              sourceNodeId: edge.sourceNodeId,
              targetNodeId: edge.targetNodeId,
              config: edge.config || {},
            })),
          },
        },
        include: {
          nodes: true,
          edges: true,
        },
      });

      // Update template usage stats
      const currentStats = template.stats as any;
      await prisma.workflowTemplate.update({
        where: { id },
        data: {
          stats: {
            ...currentStats,
            uses: (currentStats.uses || 0) + 1,
          },
        },
      });

      res.status(201).json({
        success: true,
        data: workflow,
      });
    } catch (error) {
      next(error);
    }
  }
);

const testWorkflowSchema = z.object({
  testLeadId: z.string().optional(),
});

// POST /workflows/:id/test - Run workflow test
workflowsRouter.post(
  '/:id/test',
  authorize('owner', 'admin', 'manager', 'agent'),
  validate(testWorkflowSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;
      const { testLeadId } = req.body;

      // Verify workflow exists and belongs to workspace
      const workflow = await prisma.workflow.findFirst({
        where: {
          id,
          workspaceId,
        },
        include: {
          nodes: {
            orderBy: { createdAt: 'asc' },
          },
          edges: true,
        },
      });

      if (!workflow) {
        throw new NotFoundError('Workflow');
      }

      // If testLeadId is provided, verify lead exists and belongs to workspace
      if (testLeadId) {
        const lead = await prisma.lead.findFirst({
          where: {
            id: testLeadId,
            workspaceId,
          },
        });

        if (!lead) {
          return res.status(404).json({
            success: false,
            error: {
              type: 'not_found',
              title: 'Lead not found',
              detail: 'Test lead not found in this workspace',
            },
          });
        }
      }

      // Create WorkflowTestRun entry
      const testRun = await prisma.workflowTestRun.create({
        data: {
          workflowId: id,
          testLeadId,
          status: 'pending',
          result: {
            workflow: {
              id: workflow.id,
              name: workflow.name,
              nodes: workflow.nodes,
              edges: workflow.edges,
            },
            testLeadId,
          },
          startedAt: new Date(),
        },
      });

      res.status(202).json({
        success: true,
        data: {
          message: 'Workflow test run queued',
          testRunId: testRun.id,
          status: testRun.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /workflows/:id/test/:testRunId - Get test run results
workflowsRouter.get(
  '/:id/test/:testRunId',
  authorize('owner', 'admin', 'manager', 'agent', 'viewer'),
  async (req, res, next) => {
    try {
      const { id, testRunId } = req.params;
      const workspaceId = req.user!.workspaceId;

      // Verify workflow exists and belongs to workspace
      const workflow = await prisma.workflow.findFirst({
        where: {
          id,
          workspaceId,
        },
      });

      if (!workflow) {
        throw new NotFoundError('Workflow');
      }

      // Get test run
      const testRun = await prisma.workflowTestRun.findUnique({
        where: {
          id: testRunId,
        },
        include: {
          testLead: {
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
              profileUrl: true,
              platform: true,
            },
          },
        },
      });

      if (!testRun || testRun.workflowId !== id) {
        return res.status(404).json({
          success: false,
          error: {
            type: 'not_found',
            title: 'Test run not found',
            detail: 'The specified test run does not exist for this workflow',
          },
        });
      }

      res.json({
        success: true,
        data: testRun,
      });
    } catch (error) {
      next(error);
    }
  }
);
