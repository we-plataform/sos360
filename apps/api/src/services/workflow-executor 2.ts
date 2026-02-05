import { prisma } from '@lia360/database';
import { logger } from '../lib/logger.js';
import { ValidationError } from '../lib/errors.js';

/**
 * Workflow node types (defined inline to avoid module resolution issues)
 */
type NodeType =
  | 'trigger_lead_stage_entry'
  | 'trigger_lead_score_change'
  | 'trigger_lead_field_change'
  | 'trigger_time_based'
  | 'trigger_webhook'
  | 'trigger_manual'
  | 'action_send_message'
  | 'action_add_tag'
  | 'action_remove_tag'
  | 'action_assign_user'
  | 'action_change_stage'
  | 'action_update_lead_field'
  | 'action_enqueue_agent'
  | 'action_send_webhook'
  | 'action_add_to_audience'
  | 'action_remove_from_audience'
  | 'action_wait_until_time'
  | 'action_increment_score'
  | 'action_decrement_score'
  | 'condition'
  | 'delay'
  | 'loop'
  | 'end';

/**
 * Workflow node interface
 */
interface WorkflowNode {
  id: string;
  type: NodeType;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

/**
 * Workflow edge interface
 */
interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  config?: Record<string, unknown>;
}

/**
 * Lead data for workflow execution
 */
export interface LeadContext {
  id: string;
  workspaceId: string;
  data: Record<string, unknown>;
}

/**
 * Execution state tracking
 */
export interface ExecutionState {
  currentNodeId: string | null;
  visitedNodes: string[];
  completedNodes: string[];
  skippedNodes: string[];
  errors: Array<{ nodeId: string; error: string }>;
  metadata: Record<string, unknown>;
  status: 'running' | 'completed' | 'failed' | 'paused';
  scheduledResumeTime?: string;
  delayNodeId?: string;
  loopState?: {
    loopNodeId: string;
    currentIndex: number;
    totalItems: number;
    items: Array<{ id: string; data: Record<string, unknown> }>;
    completedIterations: string[];
  };
}

/**
 * Execution result
 */
export interface ExecutionResult {
  success: boolean;
  state: ExecutionState;
  actionsTaken: Array<{ nodeId: string; action: string; result: unknown }>;
  error?: string;
}

/**
 * Trigger node types that can start a workflow
 */
const TRIGGER_NODE_TYPES = [
  'trigger_lead_stage_entry',
  'trigger_lead_score_change',
  'trigger_lead_field_change',
  'trigger_time_based',
  'trigger_webhook',
  'trigger_manual',
];

/**
 * Action node types that perform operations
 */
const ACTION_NODE_TYPES = [
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
];

/**
 * Flow control node types
 */
// const FLOW_CONTROL_NODE_TYPES = ['condition', 'delay', 'loop', 'end']; // Used in later subtasks

/**
 * Execute a workflow for a given lead
 * @param workflowId - Workflow ID to execute
 * @param leadContext - Lead context data
 * @param isDryRun - If true, don't persist changes (for testing)
 * @returns Execution result with state and actions taken
 */
export async function executeWorkflow(
  workflowId: string,
  leadContext: LeadContext,
  isDryRun: boolean = false
): Promise<ExecutionResult> {
  const startTime = Date.now();

  try {
    // Fetch workflow with nodes and edges
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        nodes: true,
        edges: true,
      },
    });

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Build node and edge maps for efficient traversal
    const nodeMap = new Map<string, WorkflowNode>();
    workflow.nodes.forEach((node) => {
      nodeMap.set(node.id, {
        id: node.id,
        type: node.type as NodeType,
        config: node.config as Record<string, unknown>,
        position: node.position as { x: number; y: number },
      });
    });

    const edgeMap = buildEdgeMap(workflow.edges as WorkflowEdge[]);

    // Find trigger node (starting point)
    const triggerNode = findTriggerNode(Array.from(nodeMap.values()));
    if (!triggerNode) {
      throw new ValidationError('Workflow must have exactly one trigger node', [
        { field: 'workflow', message: 'No trigger node found' },
      ]);
    }

    // Initialize execution state
    const state: ExecutionState = {
      currentNodeId: triggerNode.id,
      visitedNodes: [],
      completedNodes: [],
      skippedNodes: [],
      errors: [],
      metadata: {
        workflowId,
        leadId: leadContext.id,
        startedAt: new Date().toISOString(),
        isDryRun,
      },
      status: 'running',
    };

    const actionsTaken: Array<{ nodeId: string; action: string; result: unknown }> = [];

    // Execute workflow sequentially
    let currentNode = triggerNode;
    let executionComplete = false;
    let maxIterations = 1000; // Safety limit to prevent infinite loops
    let iterations = 0;

    while (!executionComplete && iterations < maxIterations) {
      iterations++;
      state.visitedNodes.push(currentNode.id);
      state.currentNodeId = currentNode.id;

      try {
        // Execute node based on type
        const result = await executeNode(
          currentNode,
          leadContext,
          state,
          isDryRun
        );

        if (result.pause) {
          // Node execution triggered a pause (delay node)
          // Stop execution and return paused state
          state.status = 'paused';
          executionComplete = true;

          actionsTaken.push({
            nodeId: currentNode.id,
            action: result.action || 'paused',
            result: result.data,
          });

          logger.info({
            workflowId,
            leadId: leadContext.id,
            nodeId: currentNode.id,
            scheduledResumeTime: state.scheduledResumeTime,
            nodesVisited: state.visitedNodes.length,
          }, 'Workflow execution paused');
        } else if (result.success) {
          state.completedNodes.push(currentNode.id);

          if (result.action) {
            actionsTaken.push({
              nodeId: currentNode.id,
              action: result.action,
              result: result.data,
            });
          }

          // Find next node via edges
          let nextNodeId: string | null = null;

          // For condition nodes, use the condition result to select branch
          if (currentNode.type === 'condition' && result.conditionResult !== undefined) {
            nextNodeId = getNextNodeIdForCondition(currentNode.id, result.conditionResult, edgeMap);
          } else {
            // For other nodes, use default next node
            nextNodeId = getNextNodeId(currentNode.id, edgeMap);
          }

          if (!nextNodeId) {
            // No more nodes to execute
            executionComplete = true;
            state.status = 'completed';
            logger.info({
              workflowId,
              leadId: leadContext.id,
              nodesVisited: state.visitedNodes.length,
              duration: Date.now() - startTime,
            }, 'Workflow execution completed');
          } else {
            const nextNode = nodeMap.get(nextNodeId);
            if (!nextNode) {
              throw new Error(`Next node ${nextNodeId} not found in workflow`);
            }
            currentNode = nextNode;
          }
        } else if (result.skip) {
          // Node execution was skipped (e.g., condition not met)
          state.skippedNodes.push(currentNode.id);

          // Still find next node
          const nextNodeId = getNextNodeId(currentNode.id, edgeMap);
          if (!nextNodeId) {
            executionComplete = true;
            state.status = 'completed';
          } else {
            const nextNode = nodeMap.get(nextNodeId);
            if (!nextNode) {
              throw new Error(`Next node ${nextNodeId} not found in workflow`);
            }
            currentNode = nextNode;
          }
        } else {
          // Node execution failed
          state.errors.push({
            nodeId: currentNode.id,
            error: result.error || 'Unknown error',
          });
          executionComplete = true;
          state.status = 'failed';
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({
          workflowId,
          nodeId: currentNode.id,
          leadId: leadContext.id,
          error: errorMessage,
        }, 'Node execution failed');

        state.errors.push({
          nodeId: currentNode.id,
          error: errorMessage,
        });
        executionComplete = true;
        state.status = 'failed';
      }
    }

    // Update metadata
    state.metadata = {
      ...state.metadata,
      completedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      totalNodes: nodeMap.size,
      iterations,
    };

    // Update workflow stats (unless dry run)
    if (!isDryRun) {
      await updateWorkflowStats(workflowId, state.status === 'completed');
    }

    return {
      success: state.status === 'completed' || state.status === 'paused',
      state,
      actionsTaken,
      error: state.status === 'failed' ? state.errors[0]?.error : undefined,
    };
  } catch (error) {
    logger.error({
      workflowId,
      leadId: leadContext.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Workflow execution failed');

    return {
      success: false,
      state: {
        currentNodeId: null,
        visitedNodes: [],
        completedNodes: [],
        skippedNodes: [],
        errors: [{
          nodeId: 'workflow',
          error: error instanceof Error ? error.message : 'Unknown error',
        }],
        metadata: {
          workflowId,
          leadId: leadContext.id,
          isDryRun,
        },
        status: 'failed',
      },
      actionsTaken: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Evaluate a condition node against lead context
 * @param node - Condition node to evaluate
 * @param leadContext - Lead data for evaluation
 * @returns Condition result (true/false)
 */
function evaluateCondition(
  node: WorkflowNode,
  leadContext: LeadContext
): { result: boolean; error?: string } {
  const { config } = node;
  const field = config.conditionField as string | undefined;
  const operator = config.conditionOperator as string | undefined;
  const value = config.conditionValue;

  if (!field || !operator) {
    return {
      result: false,
      error: 'Condition node missing conditionField or conditionOperator',
    };
  }

  // Get the field value from lead context
  const fieldValue = getNestedValue(leadContext.data, field);

  try {
    switch (operator) {
      case 'eq':
        return { result: fieldValue === value };

      case 'ne':
        return { result: fieldValue !== value };

      case 'gt':
        return { result: typeof fieldValue === 'number' && typeof value === 'number' && fieldValue > value };

      case 'gte':
        return { result: typeof fieldValue === 'number' && typeof value === 'number' && fieldValue >= value };

      case 'lt':
        return { result: typeof fieldValue === 'number' && typeof value === 'number' && fieldValue < value };

      case 'lte':
        return { result: typeof fieldValue === 'number' && typeof value === 'number' && fieldValue <= value };

      case 'contains':
        return { result: typeof fieldValue === 'string' && typeof value === 'string' && fieldValue.includes(value) };

      case 'not_contains':
        return { result: typeof fieldValue === 'string' && typeof value === 'string' && !fieldValue.includes(value) };

      case 'is_empty':
        return { result: fieldValue === null || fieldValue === undefined || fieldValue === '' };

      case 'is_not_empty':
        return { result: fieldValue !== null && fieldValue !== undefined && fieldValue !== '' };

      default:
        return {
          result: false,
          error: `Unknown condition operator: ${operator}`,
        };
    }
  } catch (error) {
    return {
      result: false,
      error: error instanceof Error ? error.message : 'Unknown error evaluating condition',
    };
  }
}

/**
 * Get nested value from object using dot notation
 * @param obj - Object to get value from
 * @param path - Dot-separated path (e.g., "user.name" or "score")
 * @returns Value at path, or undefined if not found
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Execute a single workflow node
 */
async function executeNode(
  node: WorkflowNode,
  leadContext: LeadContext,
  _state: ExecutionState,
  isDryRun: boolean
): Promise<{ success: boolean; action?: string; data?: unknown; skip?: boolean; error?: string; conditionResult?: boolean; pause?: boolean }> {
  const { type } = node;

  // Handle trigger nodes (just mark as visited, no action)
  if (TRIGGER_NODE_TYPES.includes(type)) {
    return { success: true };
  }

  // Handle end node
  if (type === 'end') {
    return { success: true };
  }

  // Handle action nodes
  if (ACTION_NODE_TYPES.includes(type)) {
    return await executeActionNode(node, leadContext, isDryRun);
  }

  // Handle flow control nodes
  if (type === 'condition') {
    const evaluation = evaluateCondition(node, leadContext);
    if (evaluation.error) {
      return {
        success: false,
        error: evaluation.error,
      };
    }

    logger.info({
      nodeId: node.id,
      field: node.config.conditionField,
      operator: node.config.conditionOperator,
      value: node.config.conditionValue,
      result: evaluation.result,
    }, 'Condition evaluated');

    // Return success with condition result for routing
    return {
      success: true,
      action: 'condition_evaluated',
      data: {
        field: node.config.conditionField,
        operator: node.config.conditionOperator,
        value: node.config.conditionValue,
        result: evaluation.result,
      },
      conditionResult: evaluation.result,
    };
  }

  if (type === 'delay') {
    return await executeDelayNode(node, leadContext, _state, isDryRun);
  }

  if (type === 'loop') {
    return await executeLoopNode(node, leadContext, _state, isDryRun);
  }

  logger.warn({ nodeType: type }, 'Unknown node type encountered');
  return { success: true }; // Skip unknown nodes
}

/**
 * Execute an action node
 */
async function executeActionNode(
  node: WorkflowNode,
  _leadContext: LeadContext,
  isDryRun: boolean
): Promise<{ success: boolean; action: string; data?: unknown; error?: string }> {
  const { type, config } = node;

  try {
    switch (type) {
      case 'action_send_message':
        if (isDryRun) {
          return {
            success: true,
            action: 'send_message',
            data: { message: config.template || 'Default message', dryRun: true },
          };
        }
        // TODO: Implement actual message sending
        return {
          success: true,
          action: 'send_message',
          data: { message: config.template || 'Default message' },
        };

      case 'action_add_tag':
        if (isDryRun) {
          return {
            success: true,
            action: 'add_tag',
            data: { tag: config.tag, dryRun: true },
          };
        }
        // TODO: Implement tag addition
        return {
          success: true,
          action: 'add_tag',
          data: { tag: config.tag },
        };

      case 'action_remove_tag':
        if (isDryRun) {
          return {
            success: true,
            action: 'remove_tag',
            data: { tag: config.tag, dryRun: true },
          };
        }
        // TODO: Implement tag removal
        return {
          success: true,
          action: 'remove_tag',
          data: { tag: config.tag },
        };

      case 'action_assign_user':
        if (isDryRun) {
          return {
            success: true,
            action: 'assign_user',
            data: { userId: config.assignedUserId, dryRun: true },
          };
        }
        // TODO: Implement user assignment
        return {
          success: true,
          action: 'assign_user',
          data: { userId: config.assignedUserId },
        };

      case 'action_change_stage':
        if (isDryRun) {
          return {
            success: true,
            action: 'change_stage',
            data: { stageId: config.targetStageId, dryRun: true },
          };
        }
        // TODO: Implement stage change
        return {
          success: true,
          action: 'change_stage',
          data: { stageId: config.targetStageId },
        };

      case 'action_update_lead_field':
        if (isDryRun) {
          return {
            success: true,
            action: 'update_lead_field',
            data: { fieldData: config.leadFieldData, dryRun: true },
          };
        }
        // TODO: Implement lead field update
        return {
          success: true,
          action: 'update_lead_field',
          data: { fieldData: config.leadFieldData },
        };

      case 'action_increment_score':
        if (isDryRun) {
          return {
            success: true,
            action: 'increment_score',
            data: { increment: config.scoreIncrement, dryRun: true },
          };
        }
        // TODO: Implement score increment
        return {
          success: true,
          action: 'increment_score',
          data: { increment: config.scoreIncrement },
        };

      case 'action_decrement_score':
        if (isDryRun) {
          return {
            success: true,
            action: 'decrement_score',
            data: { decrement: config.scoreIncrement, dryRun: true },
          };
        }
        // TODO: Implement score decrement
        return {
          success: true,
          action: 'decrement_score',
          data: { decrement: config.scoreIncrement },
        };

      case 'action_add_to_audience':
        if (isDryRun) {
          return {
            success: true,
            action: 'add_to_audience',
            data: { audienceId: config.audienceId, dryRun: true },
          };
        }
        // TODO: Implement audience addition
        return {
          success: true,
          action: 'add_to_audience',
          data: { audienceId: config.audienceId },
        };

      case 'action_remove_from_audience':
        if (isDryRun) {
          return {
            success: true,
            action: 'remove_from_audience',
            data: { audienceId: config.audienceId, dryRun: true },
          };
        }
        // TODO: Implement audience removal
        return {
          success: true,
          action: 'remove_from_audience',
          data: { audienceId: config.audienceId },
        };

      case 'action_enqueue_agent':
        if (isDryRun) {
          return {
            success: true,
            action: 'enqueue_agent',
            data: { task: config.agentTask, dryRun: true },
          };
        }
        // TODO: Implement agent task enqueueing
        return {
          success: true,
          action: 'enqueue_agent',
          data: { task: config.agentTask },
        };

      case 'action_send_webhook':
        if (isDryRun) {
          return {
            success: true,
            action: 'send_webhook',
            data: { url: config.webhookUrl, dryRun: true },
          };
        }
        // TODO: Implement webhook sending
        return {
          success: true,
          action: 'send_webhook',
          data: { url: config.webhookUrl },
        };

      case 'action_wait_until_time':
        // This will be handled in subtask-4-4 (delay execution)
        return {
          success: true,
          action: 'wait_until_time',
          data: { waitUntil: config.waitUntil },
        };

      default:
        return {
          success: true,
          action: 'unknown',
          data: { type },
        };
    }
  } catch (error) {
    return {
      success: false,
      action: type,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute a delay node
 * Pauses workflow execution for a specified duration
 * @param node - Delay node to execute
 * @param leadContext - Lead context data
 * @param state - Execution state
 * @param isDryRun - If true, don't persist changes
 */
async function executeDelayNode(
  node: WorkflowNode,
  leadContext: LeadContext,
  state: ExecutionState,
  isDryRun: boolean
): Promise<{ success: boolean; action?: string; data?: unknown; skip?: boolean; error?: string; pause?: boolean }> {
  const { config } = node;

  try {
    // Determine delay duration
    let delaySeconds: number;

    if (config.delayUntil) {
      // Absolute time delay (wait until specific time)
      const delayUntil = new Date(config.delayUntil as string);
      const now = new Date();
      const diffMs = delayUntil.getTime() - now.getTime();

      if (diffMs <= 0) {
        // Delay time has passed, skip the delay
        logger.info({
          nodeId: node.id,
          delayUntil: config.delayUntil,
          now: now.toISOString(),
        }, 'Delay time has passed, continuing execution');

        return {
          success: true,
          skip: true,
          action: 'delay_expired',
          data: { delayUntil: config.delayUntil, now: now.toISOString() },
        };
      }

      delaySeconds = Math.floor(diffMs / 1000);
    } else if (config.delaySeconds) {
      // Relative time delay (wait for X seconds)
      delaySeconds = config.delaySeconds as number;

      if (delaySeconds < 0) {
        return {
          success: false,
          error: 'Delay seconds cannot be negative',
        };
      }

      if (delaySeconds === 0) {
        // Zero delay, skip immediately
        return {
          success: true,
          skip: true,
          action: 'delay_zero',
          data: { delaySeconds: 0 },
        };
      }
    } else {
      return {
        success: false,
        error: 'Delay node must have delaySeconds or delayUntil in config',
      };
    }

    // Calculate scheduled resume time
    const scheduledResumeTime = new Date(Date.now() + delaySeconds * 1000);

    // Update execution state with pause information
    state.status = 'paused';
    state.scheduledResumeTime = scheduledResumeTime.toISOString();
    state.delayNodeId = node.id;

    // Persist execution state if not dry run
    if (!isDryRun) {
      await persistExecutionState(
        state.metadata.workflowId as string,
        leadContext.id,
        state
      );
    }

    logger.info({
      nodeId: node.id,
      delaySeconds,
      scheduledResumeTime: scheduledResumeTime.toISOString(),
      leadId: leadContext.id,
      workflowId: state.metadata.workflowId,
    }, 'Workflow execution paused at delay node');

    return {
      success: true,
      action: 'delay_started',
      data: {
        delaySeconds,
        scheduledResumeTime: scheduledResumeTime.toISOString(),
        delayNodeId: node.id,
      },
      pause: true,
    };
  } catch (error) {
    return {
      success: false,
      action: 'delay',
      error: error instanceof Error ? error.message : 'Unknown error executing delay',
    };
  }
}

/**
 * Execute a loop node
 * Iterates over a list of leads or audience members and executes child nodes for each
 * @param node - Loop node to execute
 * @param leadContext - Lead context data (original trigger lead)
 * @param state - Execution state
 * @param isDryRun - If true, don't persist changes
 */
async function executeLoopNode(
  node: WorkflowNode,
  leadContext: LeadContext,
  state: ExecutionState,
  _isDryRun: boolean
): Promise<{ success: boolean; action?: string; data?: unknown; skip?: boolean; error?: string }> {
  const { config } = node;
  const workspaceId = leadContext.workspaceId;

  try {
    const iterationType = config.iterationType as 'leads' | 'audience' | undefined;
    const maxIterations = (config.maxIterations as number) || 100;

    if (!iterationType) {
      return {
        success: false,
        error: 'Loop node missing iterationType in config',
      };
    }

    // Initialize or resume loop state
    let loopState = state.loopState;

    if (!loopState || loopState.loopNodeId !== node.id) {
      // First time entering this loop - fetch items to iterate over
      let items: Array<{ id: string; data: Record<string, unknown> }> = [];

      if (iterationType === 'leads') {
        // Fetch leads based on filters
        const leads = await prisma.lead.findMany({
          where: {
            workspaceId,
            ...(config.pipelineStageId ? { pipelineStageId: config.pipelineStageId as string } : {}),
            ...(config.tags && Array.isArray(config.tags) && config.tags.length > 0
              ? { tags: { some: { tag: { name: { in: config.tags as string[] } } } } }
              : {}),
          },
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            profileUrl: true,
            platform: true,
            avatarUrl: true,
            bio: true,
            headline: true,
            company: true,
            industry: true,
            location: true,
          },
          take: maxIterations,
        });

        items = leads.map((lead) => ({
          id: lead.id,
          data: lead as Record<string, unknown>,
        }));
      } else if (iterationType === 'audience') {
        const audienceId = config.audienceId as string | undefined;

        if (!audienceId) {
          return {
            success: false,
            error: 'Loop node with audience iterationType missing audienceId in config',
          };
        }

        // Fetch audience filter criteria
        const audience = await prisma.audience.findFirst({
          where: {
            id: audienceId,
            workspaceId,
          },
        });

        if (!audience) {
          return {
            success: false,
            error: `Audience ${audienceId} not found`,
          };
        }

        // Build where clause from audience filters
        const audienceWhere: Record<string, unknown> = { workspaceId };

        // Gender filter
        if (audience.gender && audience.gender.length > 0 && !audience.ignoreGenderIfUnknown) {
          audienceWhere.gender = { in: audience.gender };
        }

        // Country filter (using location field)
        if (audience.countries && audience.countries.length > 0 && !audience.ignoreCountryIfUnknown) {
          // Check if location contains any of the country codes
          audienceWhere.location = {
            in: audience.countries.map((c) => c.toLowerCase()),
          };
        }

        // Verification filter
        if (audience.verifiedFilter === 'verified_only') {
          audienceWhere.verified = true;
        } else if (audience.verifiedFilter === 'unverified_only') {
          audienceWhere.verified = false;
        }

        // Follower count filter
        if (audience.followersMin !== null || audience.followersMax !== null) {
          const followersFilter: Record<string, unknown> = {};
          if (audience.followersMin !== null) {
            followersFilter.gte = audience.followersMin;
          }
          if (audience.followersMax !== null) {
            followersFilter.lte = audience.followersMax;
          }
          audienceWhere.followersCount = followersFilter;
        }

        // Exclude filters
        if (audience.excludeNoPhoto) {
          audienceWhere.avatarUrl = { not: null };
        }

        // Fetch leads matching audience criteria
        const leads = await prisma.lead.findMany({
          where: audienceWhere,
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            profileUrl: true,
            platform: true,
            avatarUrl: true,
            bio: true,
            headline: true,
            company: true,
            industry: true,
            location: true,
          },
          take: maxIterations,
        });

        items = leads.map((lead) => ({
          id: lead.id,
          data: lead as Record<string, unknown>,
        }));
      }

      if (items.length === 0) {
        logger.info({
          nodeId: node.id,
          iterationType,
          workspaceId,
        }, 'Loop has no items to iterate, skipping');

        return {
          success: true,
          skip: true,
          action: 'loop_empty',
          data: { iterationType, itemCount: 0 },
        };
      }

      // Initialize loop state
      loopState = {
        loopNodeId: node.id,
        currentIndex: 0,
        totalItems: items.length,
        items,
        completedIterations: [],
      };

      logger.info({
        nodeId: node.id,
        iterationType,
        itemCount: items.length,
        maxIterations,
      }, 'Loop initialized with items');
    }

    // Check if loop is complete
    if (loopState.currentIndex >= loopState.totalItems) {
      logger.info({
        nodeId: node.id,
        totalIterations: loopState.totalItems,
        completedIterations: loopState.completedIterations.length,
      }, 'Loop completed');

      return {
        success: true,
        action: 'loop_completed',
        data: {
          totalIterations: loopState.totalItems,
          completedIterations: loopState.completedIterations,
        },
      };
    }

    // Execute for current item
    const currentItem = loopState.items[loopState.currentIndex];
    const currentIteration = loopState.currentIndex;

    logger.info({
      nodeId: node.id,
      iterationType,
      currentIndex: currentIteration,
      totalItems: loopState.totalItems,
      itemId: currentItem.id,
    }, 'Loop iteration executing');

    // For now, we'll mark this iteration as complete
    // In a future enhancement, we could execute a sub-workflow for each item
    // The child nodes would be connected to the loop node via edges
    loopState.completedIterations.push(currentItem.id);
    loopState.currentIndex++;

    // Update state with loop progress
    state.loopState = loopState;

    // If this is the first iteration, log the loop start
    if (currentIteration === 0) {
      logger.info({
        nodeId: node.id,
        iterationType,
        totalItems: loopState.totalItems,
        workspaceId,
      }, 'Loop execution started');
    }

    // Return success with loop state for tracking
    return {
      success: true,
      action: 'loop_iteration',
      data: {
        iterationType,
        currentIndex: currentIteration,
        totalItems: loopState.totalItems,
        itemId: currentItem.id,
        remainingItems: loopState.totalItems - loopState.currentIndex,
      },
    };
  } catch (error) {
    return {
      success: false,
      action: 'loop',
      error: error instanceof Error ? error.message : 'Unknown error executing loop',
    };
  }
}

/**
 * Persist execution state to database for later resumption
 * @param workflowId - Workflow ID
 * @param leadId - Lead ID
 * @param state - Execution state to persist
 */
async function persistExecutionState(
  workflowId: string,
  leadId: string,
  state: ExecutionState
): Promise<void> {
  try {
    // Store execution state in the result JSON field
    const stateData = {
      ...state,
      pausedAt: new Date().toISOString(),
    };

    // Convert to JSON-serializable format for Prisma
    const jsonValue = JSON.parse(JSON.stringify(stateData));

    // Check if there's an existing test run for this workflow/lead combination
    const existingRun = await prisma.workflowTestRun.findFirst({
      where: {
        workflowId,
        testLeadId: leadId,
        status: { in: ['running', 'pending'] },
      },
    });

    if (existingRun) {
      // Update existing test run with paused state data
      await prisma.workflowTestRun.update({
        where: { id: existingRun.id },
        data: {
          result: jsonValue,
        },
      });
    } else {
      // Create new test run to store paused state
      await prisma.workflowTestRun.create({
        data: {
          workflowId,
          testLeadId: leadId,
          status: 'running',
          result: jsonValue,
          startedAt: new Date(),
        },
      });
    }

    logger.debug({
      workflowId,
      leadId,
      stateStatus: state.status,
      scheduledResumeTime: state.scheduledResumeTime,
    }, 'Execution state persisted');
  } catch (error) {
    logger.error({
      workflowId,
      leadId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Failed to persist execution state');
    // Don't throw - allow execution to continue even if persistence fails
  }
}

/**
 * Resume workflow execution from a paused state
 * @param workflowId - Workflow ID to resume
 * @param leadContext - Lead context data
 * @param executionState - Previous execution state to resume from
 * @param isDryRun - If true, don't persist changes
 * @returns Execution result with state and actions taken
 */
export async function resumeWorkflow(
  workflowId: string,
  leadContext: LeadContext,
  executionState: ExecutionState,
  isDryRun: boolean = false
): Promise<ExecutionResult> {
  const startTime = Date.now();

  try {
    // Fetch workflow with nodes and edges
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        nodes: true,
        edges: true,
      },
    });

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Build node and edge maps
    const nodeMap = new Map<string, WorkflowNode>();
    workflow.nodes.forEach((node) => {
      nodeMap.set(node.id, {
        id: node.id,
        type: node.type as NodeType,
        config: node.config as Record<string, unknown>,
        position: node.position as { x: number; y: number },
      });
    });

    const edgeMap = buildEdgeMap(workflow.edges as WorkflowEdge[]);

    // Resume execution from the delay node
    const delayNodeId = executionState.delayNodeId;
    if (!delayNodeId) {
      throw new Error('Execution state does not contain delayNodeId');
    }

    const delayNode = nodeMap.get(delayNodeId);
    if (!delayNode) {
      throw new Error(`Delay node ${delayNodeId} not found in workflow`);
    }

    // Update execution state
    const state: ExecutionState = {
      ...executionState,
      status: 'running',
      metadata: {
        ...executionState.metadata,
        resumedAt: new Date().toISOString(),
        isDryRun,
      },
    };

    const actionsTaken: Array<{ nodeId: string; action: string; result: unknown }> = [];

    // Mark delay node as completed and move to next node
    state.completedNodes.push(delayNodeId);
    state.visitedNodes.push(delayNodeId);

    actionsTaken.push({
      nodeId: delayNodeId,
      action: 'delay_completed',
      result: {
        delayDuration: state.scheduledResumeTime,
        resumedAt: new Date().toISOString(),
      },
    });

    // Find next node after delay
    const nextNodeId = getNextNodeId(delayNodeId, edgeMap);

    if (!nextNodeId) {
      // No more nodes to execute
      state.status = 'completed';
      state.currentNodeId = null;

      logger.info({
        workflowId,
        leadId: leadContext.id,
        nodesVisited: state.visitedNodes.length,
        duration: Date.now() - startTime,
      }, 'Workflow execution completed after delay');

      // Update workflow stats
      if (!isDryRun) {
        await updateWorkflowStats(workflowId, true);
      }

      return {
        success: true,
        state,
        actionsTaken,
      };
    }

    const nextNode = nodeMap.get(nextNodeId);
    if (!nextNode) {
      throw new Error(`Next node ${nextNodeId} not found in workflow`);
    }

    // Continue execution from next node
    let currentNode = nextNode;
    let executionComplete = false;
    let maxIterations = 1000;
    let iterations = 0;

    while (!executionComplete && iterations < maxIterations) {
      iterations++;
      state.visitedNodes.push(currentNode.id);
      state.currentNodeId = currentNode.id;

      try {
        const result = await executeNode(
          currentNode,
          leadContext,
          state,
          isDryRun
        );

        if (result.pause) {
          // Encountered another delay, pause again
          state.status = 'paused';

          if (!isDryRun) {
            await persistExecutionState(workflowId, leadContext.id, state);
          }

          return {
            success: true,
            state,
            actionsTaken,
          };
        }

        if (result.success) {
          state.completedNodes.push(currentNode.id);

          if (result.action) {
            actionsTaken.push({
              nodeId: currentNode.id,
              action: result.action,
              result: result.data,
            });
          }

          // Find next node
          let nextNodeId: string | null = null;

          if (currentNode.type === 'condition' && result.conditionResult !== undefined) {
            nextNodeId = getNextNodeIdForCondition(currentNode.id, result.conditionResult, edgeMap);
          } else {
            nextNodeId = getNextNodeId(currentNode.id, edgeMap);
          }

          if (!nextNodeId) {
            executionComplete = true;
            state.status = 'completed';
            logger.info({
              workflowId,
              leadId: leadContext.id,
              nodesVisited: state.visitedNodes.length,
              duration: Date.now() - startTime,
            }, 'Workflow execution completed');
          } else {
            const nextNode = nodeMap.get(nextNodeId);
            if (!nextNode) {
              throw new Error(`Next node ${nextNodeId} not found in workflow`);
            }
            currentNode = nextNode;
          }
        } else if (result.skip) {
          state.skippedNodes.push(currentNode.id);

          const nextNodeId = getNextNodeId(currentNode.id, edgeMap);
          if (!nextNodeId) {
            executionComplete = true;
            state.status = 'completed';
          } else {
            const nextNode = nodeMap.get(nextNodeId);
            if (!nextNode) {
              throw new Error(`Next node ${nextNodeId} not found in workflow`);
            }
            currentNode = nextNode;
          }
        } else {
          state.errors.push({
            nodeId: currentNode.id,
            error: result.error || 'Unknown error',
          });
          executionComplete = true;
          state.status = 'failed';
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({
          workflowId,
          nodeId: currentNode.id,
          leadId: leadContext.id,
          error: errorMessage,
        }, 'Node execution failed');

        state.errors.push({
          nodeId: currentNode.id,
          error: errorMessage,
        });
        executionComplete = true;
        state.status = 'failed';
      }
    }

    // Update metadata
    state.metadata = {
      ...state.metadata,
      completedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      totalNodes: nodeMap.size,
      iterations,
    };

    // Update workflow stats
    if (!isDryRun) {
      await updateWorkflowStats(workflowId, state.status === 'completed');
    }

    return {
      success: state.status === 'completed' || state.status === 'paused',
      state,
      actionsTaken,
      error: state.status === 'failed' ? state.errors[0]?.error : undefined,
    };
  } catch (error) {
    logger.error({
      workflowId,
      leadId: leadContext.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Workflow resumption failed');

    return {
      success: false,
      state: {
        currentNodeId: null,
        visitedNodes: [],
        completedNodes: [],
        skippedNodes: [],
        errors: [{
          nodeId: 'workflow',
          error: error instanceof Error ? error.message : 'Unknown error',
        }],
        metadata: {
          workflowId,
          leadId: leadContext.id,
          isDryRun,
        },
        status: 'failed',
      },
      actionsTaken: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build edge adjacency map for efficient traversal
 * Returns a map of source node ID to array of outgoing edges
 * Supports multiple edges per node (for condition branching)
 */
function buildEdgeMap(edges: WorkflowEdge[]): Map<string, WorkflowEdge[]> {
  const edgeMap = new Map<string, WorkflowEdge[]>();

  edges.forEach((edge) => {
    const outgoingEdges = edgeMap.get(edge.sourceNodeId) || [];
    outgoingEdges.push(edge);
    edgeMap.set(edge.sourceNodeId, outgoingEdges);
  });

  return edgeMap;
}

/**
 * Find the next node ID to execute
 * For regular nodes: returns the first (and typically only) outgoing edge's target
 * For condition nodes: use getNextNodeIdForCondition instead
 */
function getNextNodeId(
  currentNodeId: string,
  edgeMap: Map<string, WorkflowEdge[]>
): string | null {
  const edges = edgeMap.get(currentNodeId);
  if (!edges || edges.length === 0) {
    return null;
  }
  return edges[0].targetNodeId;
}

/**
 * Find the next node ID based on condition evaluation result
 * @param currentNodeId - Current node ID (must be a condition node)
 * @param conditionResult - Result of condition evaluation (true/false)
 * @param edgeMap - Edge adjacency map
 * @returns Target node ID for the matching branch, or null if not found
 */
function getNextNodeIdForCondition(
  currentNodeId: string,
  conditionResult: boolean,
  edgeMap: Map<string, WorkflowEdge[]>
): string | null {
  const edges = edgeMap.get(currentNodeId);
  if (!edges || edges.length === 0) {
    return null;
  }

  // Find the edge with matching condition ('true' or 'false')
  const targetCondition = conditionResult ? 'true' : 'false';
  const matchingEdge = edges.find((edge) => edge.config?.condition === targetCondition);

  if (!matchingEdge) {
    logger.warn({
      nodeId: currentNodeId,
      conditionResult,
      edges: edges.map((e) => ({ id: e.id, config: e.config })),
    }, 'Condition edge not found for result');
    return null;
  }

  return matchingEdge.targetNodeId;
}

/**
 * Find the trigger node in the workflow
 */
function findTriggerNode(nodes: WorkflowNode[]): WorkflowNode | null {
  return nodes.find((node) => TRIGGER_NODE_TYPES.includes(node.type)) || null;
}

/**
 * Update workflow statistics after execution
 */
async function updateWorkflowStats(
  workflowId: string,
  success: boolean
): Promise<void> {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { stats: true },
    });

    if (!workflow) return;

    const stats = workflow.stats as { runs: number; success: number; failed: number };
    const newStats = {
      runs: (stats.runs || 0) + 1,
      success: (stats.success || 0) + (success ? 1 : 0),
      failed: (stats.failed || 0) + (success ? 0 : 1),
    };

    await prisma.workflow.update({
      where: { id: workflowId },
      data: { stats: newStats },
    });
  } catch (error) {
    logger.error({ workflowId, error }, 'Failed to update workflow stats');
  }
}

/**
 * Validate workflow before execution
 * @param workflowId - Workflow ID to validate
 * @returns true if valid, throws ValidationError if invalid
 */
export async function validateWorkflowForExecution(workflowId: string): Promise<boolean> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      nodes: true,
      edges: true,
    },
  });

  if (!workflow) {
    throw new ValidationError('Workflow not found', [
      { field: 'workflowId', message: 'Workflow does not exist' },
    ]);
  }

  const nodes = workflow.nodes as Array<{
    id: string;
    type: NodeType;
    config: Record<string, unknown>;
  }>;
  const edges = workflow.edges as WorkflowEdge[];

  // Import validator
  const { validateWorkflowOrThrow } = await import('./workflow-validator.js');

  // Validate workflow structure
  validateWorkflowOrThrow(
    nodes.map((n) => ({
      id: n.id,
      type: n.type,
      config: n.config,
      position: { x: 0, y: 0 }, // Position not needed for validation
    })),
    edges.map((e) => ({
      id: e.id,
      sourceNodeId: e.sourceNodeId,
      targetNodeId: e.targetNodeId,
      config: e.config as Record<string, unknown> | undefined,
    }))
  );

  return true;
}
