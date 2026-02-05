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
 * Workflow node interface (minimal, defined inline)
 */
interface WorkflowNode {
  id: string;
  type: NodeType;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

/**
 * Workflow edge interface (minimal, defined inline)
 */
interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  config?: Record<string, unknown>;
}

/**
 * Validation error detail for specific node or edge
 */
export interface WorkflowValidationError {
  type: 'missing_trigger' | 'multiple_triggers' | 'cycle' | 'disconnected' | 'invalid_condition' | 'invalid_edge';
  message: string;
  nodeId?: string;
  edgeId?: string;
  details?: Record<string, unknown>;
}

/**
 * Validation result for workflow structure
 */
export interface WorkflowValidationResult {
  valid: boolean;
  errors: WorkflowValidationError[];
  warnings: string[];
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
 * Node types that can have conditional branches
 */
const CONDITION_NODE_TYPES = ['condition'];

/**
 * Validate workflow structure before saving or executing
 * @param nodes - Workflow nodes
 * @param edges - Workflow edges
 * @returns Validation result with errors and warnings
 */
export function validateWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): WorkflowValidationResult {
  const errors: WorkflowValidationError[] = [];
  const warnings: string[] = [];

  // Basic validation: check for empty workflow
  if (nodes.length === 0) {
    errors.push({
      type: 'missing_trigger',
      message: 'Workflow must have at least one node',
    });
    return { valid: false, errors, warnings };
  }

  // 1. Validate trigger nodes
  const triggerNodes = nodes.filter((node) =>
    TRIGGER_NODE_TYPES.includes(node.type)
  );

  if (triggerNodes.length === 0) {
    errors.push({
      type: 'missing_trigger',
      message: 'Workflow must have exactly one trigger node',
    });
  } else if (triggerNodes.length > 1) {
    errors.push({
      type: 'multiple_triggers',
      message: 'Workflow must have exactly one trigger node',
      details: {
        triggerCount: triggerNodes.length,
        triggerNodeIds: triggerNodes.map((n) => n.id),
      },
    });
  }

  // 2. Build adjacency list for graph validation
  const adjacencyList = buildAdjacencyList(nodes, edges);

  // 3. Check for cycles in the workflow graph
  const cycles = detectCycles(adjacencyList);
  if (cycles.length > 0) {
    cycles.forEach((cycle) => {
      errors.push({
        type: 'cycle',
        message: `Cycle detected in workflow: ${cycle.join(' -> ')}`,
        details: { cycle },
      });
    });
  }

  // 4. Validate all nodes are reachable from trigger (if trigger exists)
  if (triggerNodes.length === 1) {
    const triggerNodeId = triggerNodes[0].id;
    const reachableNodes = getReachableNodes(triggerNodeId, adjacencyList);
    const unreachableNodes = nodes.filter(
      (node) => node.id !== triggerNodeId && !reachableNodes.has(node.id)
    );

    if (unreachableNodes.length > 0) {
      errors.push({
        type: 'disconnected',
        message: `${unreachableNodes.length} node(s) are not reachable from the trigger`,
        details: {
          unreachableNodeIds: unreachableNodes.map((n) => n.id),
        },
      });
    }
  }

  // 5. Validate condition nodes have proper branches
  const conditionNodes = nodes.filter((node) =>
    CONDITION_NODE_TYPES.includes(node.type)
  );

  conditionNodes.forEach((conditionNode) => {
    const outgoingEdges = edges.filter((e) => e.sourceNodeId === conditionNode.id);

    // Condition nodes should have 2 outgoing edges (true and false branches)
    if (outgoingEdges.length !== 2) {
      errors.push({
        type: 'invalid_condition',
        message: `Condition node must have exactly 2 outgoing branches (true and false)`,
        nodeId: conditionNode.id,
        details: {
          actualBranches: outgoingEdges.length,
          expectedBranches: 2,
        },
      });
    } else {
      // Check that we have both true and false conditions
      const conditions = outgoingEdges.map((e) => e.config?.condition);
      const hasTrue = conditions.includes('true');
      const hasFalse = conditions.includes('false');

      if (!hasTrue || !hasFalse) {
        errors.push({
          type: 'invalid_condition',
          message: `Condition node must have both 'true' and 'false' branches`,
          nodeId: conditionNode.id,
          details: {
            hasTrueBranch: hasTrue,
            hasFalseBranch: hasFalse,
          },
        });
      }
    }
  });

  // 6. Validate edge connections
  edges.forEach((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.sourceNodeId);
    const targetNode = nodes.find((n) => n.id === edge.targetNodeId);

    if (!sourceNode) {
      errors.push({
        type: 'invalid_edge',
        message: `Edge references non-existent source node`,
        edgeId: edge.id,
        details: { sourceNodeId: edge.sourceNodeId },
      });
    }

    if (!targetNode) {
      errors.push({
        type: 'invalid_edge',
        message: `Edge references non-existent target node`,
        edgeId: edge.id,
        details: { targetNodeId: edge.targetNodeId },
      });
    }

    // Check for self-loops (node connected to itself)
    if (sourceNode && targetNode && sourceNode.id === targetNode.id) {
      errors.push({
        type: 'invalid_edge',
        message: `Self-loops are not allowed`,
        edgeId: edge.id,
        details: { nodeId: sourceNode.id },
      });
    }
  });

  // 7. Add warnings for common issues
  if (nodes.length > 50) {
    warnings.push('Workflow has more than 50 nodes, which may impact performance');
  }

  const endNodes = nodes.filter((node) => node.type === 'end');
  if (endNodes.length === 0 && nodes.length > 1) {
    warnings.push('Workflow has no explicit end node, execution will stop at leaf nodes');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Build adjacency list for graph traversal
 */
function buildAdjacencyList(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): Map<string, string[]> {
  const adjacencyList = new Map<string, string[]>();

  // Initialize all nodes with empty adjacency list
  nodes.forEach((node) => {
    adjacencyList.set(node.id, []);
  });

  // Populate adjacency list from edges
  edges.forEach((edge) => {
    const neighbors = adjacencyList.get(edge.sourceNodeId) || [];
    neighbors.push(edge.targetNodeId);
    adjacencyList.set(edge.sourceNodeId, neighbors);
  });

  return adjacencyList;
}

/**
 * Detect cycles in the workflow graph using DFS
 */
function detectCycles(adjacencyList: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle - extract it from the path
        const cycleStart = path.indexOf(neighbor);
        const cycle = [...path.slice(cycleStart), neighbor];
        cycles.push(cycle);
        return true;
      }
    }

    path.pop();
    recursionStack.delete(nodeId);
    return false;
  }

  // Run DFS from each unvisited node
  adjacencyList.forEach((_, nodeId) => {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  });

  return cycles;
}

/**
 * Get all nodes reachable from a starting node using BFS
 */
function getReachableNodes(
  startNodeId: string,
  adjacencyList: Map<string, string[]>
): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [startNodeId];
  reachable.add(startNodeId);

  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    const neighbors = adjacencyList.get(currentNodeId) || [];

    for (const neighbor of neighbors) {
      if (!reachable.has(neighbor)) {
        reachable.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return reachable;
}

/**
 * Validate workflow and throw ValidationError if invalid
 * @param nodes - Workflow nodes
 * @param edges - Workflow edges
 * @throws ValidationError if workflow is invalid
 */
export function validateWorkflowOrThrow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): void {
  const result = validateWorkflow(nodes, edges);

  if (!result.valid) {
    throw new ValidationError(
      'Workflow validation failed',
      result.errors.map((error) => ({
        field: error.nodeId || error.edgeId || 'workflow',
        message: error.message,
      }))
    );
  }
}
