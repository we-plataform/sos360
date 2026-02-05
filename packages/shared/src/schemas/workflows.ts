import { z } from 'zod';

// Enums
export const workflowStatusSchema = z.enum([
  'draft',
  'active',
  'paused',
  'archived'
]);

export const nodeTypeSchema = z.enum([
  // Triggers - start of workflow
  'trigger_lead_stage_entry',
  'trigger_lead_score_change',
  'trigger_lead_field_change',
  'trigger_time_based',
  'trigger_webhook',
  'trigger_manual',
  // Actions - things to do
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
  // Flow control
  'condition',
  'delay',
  'loop',
  'end'
]);

export const workflowTestRunStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed'
]);

// Base schemas
export const nodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const workflowStatsSchema = z.object({
  runs: z.number().int().min(0),
  success: z.number().int().min(0),
  failed: z.number().int().min(0),
});

// Node schemas
export const workflowNodeConfigSchema = z.object({
  // Trigger-specific configs
  pipelineStageId: z.string().optional(),
  scoreThreshold: z.number().optional(),
  fieldName: z.string().optional(),
  fieldValue: z.any().optional(),
  scheduledTime: z.string().optional(),
  webhookUrl: z.string().url().optional(),
  webhookSecret: z.string().optional(),

  // Action-specific configs
  template: z.string().optional(),
  tag: z.string().optional(),
  assignedUserId: z.string().optional(),
  targetStageId: z.string().optional(),
  leadFieldData: z.record(z.any()).optional(),
  agentTask: z.string().optional(),
  audienceId: z.string().optional(),
  waitUntil: z.string().optional(),
  scoreIncrement: z.number().int().optional(),

  // Flow control configs
  conditionField: z.string().optional(),
  conditionOperator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains', 'is_empty', 'is_not_empty']).optional(),
  conditionValue: z.any().optional(),
  delaySeconds: z.number().int().min(0).max(86400).optional(),
  delayUntil: z.string().optional(),
  loopType: z.enum(['leads', 'audience', 'custom_list']).optional(),
  loopList: z.array(z.string()).optional(),
  maxIterations: z.number().int().min(1).max(1000).optional(),
}).passthrough(); // Allow additional properties for extensibility

export const createWorkflowNodeSchema = z.object({
  type: nodeTypeSchema,
  config: workflowNodeConfigSchema.optional(),
  position: nodePositionSchema.optional(),
});

export const updateWorkflowNodeSchema = z.object({
  id: z.string().min(1),
  config: workflowNodeConfigSchema.optional(),
  position: nodePositionSchema.optional(),
});

// Edge schemas
export const workflowEdgeConfigSchema = z.object({
  condition: z.enum(['true', 'false']).optional(), // For condition nodes
  label: z.string().optional(),
}).passthrough();

export const createWorkflowEdgeSchema = z.object({
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  config: workflowEdgeConfigSchema.optional(),
});

export const updateWorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  config: workflowEdgeConfigSchema.optional(),
});

// Workflow schemas
export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  nodes: z.array(createWorkflowNodeSchema).optional(),
  edges: z.array(createWorkflowEdgeSchema).optional(),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  status: workflowStatusSchema.optional(),
  nodes: z.array(updateWorkflowNodeSchema).optional(),
  edges: z.array(updateWorkflowEdgeSchema).optional(),
});

// Template schemas
export const createWorkflowTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  thumbnail: z.string().url().optional(),
  nodes: z.array(createWorkflowNodeSchema).min(1),
  edges: z.array(createWorkflowEdgeSchema),
});

// Action schemas
export const cloneWorkflowSchema = z.object({
  targetWorkspaceId: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
});

export const testWorkflowSchema = z.object({
  testLeadId: z.string().optional(),
});

// Filter schemas
export const workflowFiltersSchema = z.object({
  status: workflowStatusSchema.optional(),
  isTemplate: z.boolean().optional(),
  search: z.string().max(200).optional(),
  sort: z.string().optional(),
}).optional();
