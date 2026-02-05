// Workflow Node Types for Visual Builder
export type WorkflowNodeType =
  | 'trigger'
  | 'action'
  | 'condition'
  | 'delay'
  | 'branch';

// Trigger node types (matches automationTriggerTypeSchema)
export type WorkflowTriggerType =
  | 'manual'
  | 'stage_change'
  | 'tag_applied'
  | 'tag_removed'
  | 'score_threshold'
  | 'date_reached'
  | 'webhook_received'
  | 'lead_created'
  | 'field_updated';

// Action node types (matches automationActionTypeSchema)
export type WorkflowActionType =
  | 'assign_user'
  | 'add_tag'
  | 'remove_tag'
  | 'send_message'
  | 'update_field'
  | 'update_stage'
  | 'wait_delay'
  | 'webhook_call'
  | 'javascript_code'
  | 'update_score'
  | 'add_note';

// Condition operators (matches conditionOperatorSchema)
export type WorkflowConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'in_array'
  | 'not_in_array'
  | 'regex_match'
  | 'date_equals'
  | 'date_before'
  | 'date_after'
  | 'date_within_last'
  | 'date_within_next';

// Logical operators for combining conditions
export type WorkflowLogicalOperator = 'and' | 'or' | 'not';

// Base workflow node interface
export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: WorkflowNodePosition;
  data: WorkflowNodeData;
}

// Node position on canvas
export interface WorkflowNodePosition {
  x: number;
  y: number;
}

// Node data based on node type
export type WorkflowNodeData =
  | WorkflowTriggerNodeData
  | WorkflowActionNodeData
  | WorkflowConditionNodeData
  | WorkflowDelayNodeData
  | WorkflowBranchNodeData;

// Trigger node data
export interface WorkflowTriggerNodeData {
  nodeType: 'trigger';
  triggerType: WorkflowTriggerType;
  label: string;
  config: Record<string, unknown>;
  description?: string;
}

// Action node data
export interface WorkflowActionNodeData {
  nodeType: 'action';
  actionType: WorkflowActionType;
  label: string;
  config: Record<string, unknown>;
  description?: string;
}

// Condition node data
export interface WorkflowConditionNodeData {
  nodeType: 'condition';
  label: string;
  field: string;
  operator: WorkflowConditionOperator;
  value: unknown;
  caseSensitive?: boolean;
  regexPattern?: string;
  dateOffset?: {
    amount: number;
    unit: 'days' | 'hours' | 'minutes';
  };
}

// Delay node data
export interface WorkflowDelayNodeData {
  nodeType: 'delay';
  label: string;
  duration: number; // milliseconds
  description?: string;
}

// Branch node data (for conditional branching)
export interface WorkflowBranchNodeData {
  nodeType: 'branch';
  label: string;
  conditions: WorkflowConditionGroup;
  branches: WorkflowBranch[];
}

// Condition group (supports nested conditions)
export interface WorkflowConditionGroup {
  logicalOperator?: WorkflowLogicalOperator;
  conditions: Array<WorkflowCondition | WorkflowConditionGroup>;
}

// Single condition
export interface WorkflowCondition {
  field: string;
  operator: WorkflowConditionOperator;
  value?: unknown;
  caseSensitive?: boolean;
  regexPattern?: string;
  dateOffset?: {
    amount: number;
    unit: 'days' | 'hours' | 'minutes';
  };
}

// Branch (then/else actions)
export interface WorkflowBranch {
  name?: string;
  thenAction: WorkflowBranchAction;
  elseAction?: WorkflowBranchAction;
}

// Branch action types
export type WorkflowBranchActionType =
  | 'execute_actions'
  | 'jump_to_step'
  | 'exit_workflow'
  | 'wait_for_approval'
  | 'send_notification';

// Branch action configuration
export interface WorkflowBranchAction {
  type: WorkflowBranchActionType;
  [key: string]: unknown; // Allow additional properties based on type
}

// Workflow Edge (connection between nodes)
export interface WorkflowEdge {
  id: string;
  source: string; // Source node ID
  target: string; // Target node ID
  type?: 'default' | 'conditional' | 'branch';
  label?: string; // Optional label for the edge (e.g., "Yes", "No", "True", "False")
  condition?: WorkflowCondition; // Condition for conditional edges
  style?: WorkflowEdgeStyle;
}

// Edge styling
export interface WorkflowEdgeStyle {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string; // For dashed lines
  animated?: boolean; // For animated flow indicators
}

// Workflow Canvas Layout
export interface WorkflowCanvas {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: WorkflowViewport;
}

// Canvas viewport (zoom and pan state)
export interface WorkflowViewport {
  x: number;
  y: number;
  zoom: number;
}

// Workflow Definition (complete workflow for API)
export interface WorkflowDefinition {
  id?: string; // Optional for new workflows
  name: string;
  description?: string;
  trigger: {
    type: WorkflowTriggerType;
    config: Record<string, unknown>;
  };
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  enabled?: boolean;
  metadata?: WorkflowMetadata;
}

// Workflow metadata
export interface WorkflowMetadata {
  version?: number;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  tags?: string[];
  category?: string;
}

// Workflow Execution State
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  triggerType: WorkflowTriggerType;
  startedAt: string;
  completedAt?: string;
  steps: WorkflowExecutionStep[];
  result?: {
    success: boolean;
    message?: string;
    error?: string;
  };
}

// Execution step (matches AutomationStep model)
export interface WorkflowExecutionStep {
  id: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  stepType: string;
  stepName: string;
  stepOrder: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
}

// Workflow Execution History
export interface WorkflowExecutionHistory {
  workflowId: string;
  executions: WorkflowExecution[];
  summary: WorkflowExecutionSummary;
}

// Execution summary statistics
export interface WorkflowExecutionSummary {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration?: number; // in milliseconds
  lastExecutionAt?: string;
  successRate: number; // percentage
}

// Workflow Metrics
export interface WorkflowMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number; // milliseconds
  lastRunAt?: string;
  successRate: number; // percentage
  triggersByType: Record<string, number>;
  errorsByType: Record<string, number>;
}

// Workflow Validation Result
export interface WorkflowValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}

// Validation error
export interface ValidationError {
  nodeId?: string;
  edgeId?: string;
  message: string;
  field?: string;
}

// Validation warning
export interface ValidationWarning {
  nodeId?: string;
  message: string;
  field?: string;
}

// Workflow Node Template (for node palette)
export interface WorkflowNodeTemplate {
  type: WorkflowNodeType;
  subType: WorkflowTriggerType | WorkflowActionType;
  label: string;
  description: string;
  icon?: string; // Icon name (e.g., lucide-react icon name)
  category: 'trigger' | 'action' | 'logic' | 'delay';
  configSchema?: Record<string, unknown>; // JSON schema for config validation
  defaultConfig?: Record<string, unknown>;
}

// Workflow Transform (for undo/redo and history)
export interface WorkflowTransform {
  type: 'add_node' | 'remove_node' | 'update_node' | 'add_edge' | 'remove_edge' | 'move_node';
  node?: WorkflowNode;
  edge?: WorkflowEdge;
  nodeId?: string;
  edgeId?: string;
  previousPosition?: WorkflowNodePosition;
  newPosition?: WorkflowNodePosition;
  previousData?: WorkflowNodeData;
  newData?: WorkflowNodeData;
  timestamp: string;
}

// API Request/Response Types

// Create workflow request
export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  trigger: {
    type: WorkflowTriggerType;
    config: Record<string, unknown>;
  };
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  enabled?: boolean;
}

// Update workflow request
export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  trigger?: {
    type: WorkflowTriggerType;
    config: Record<string, unknown>;
  };
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  enabled?: boolean;
}

// Execute workflow request
export interface ExecuteWorkflowRequest {
  leadIds: string[];
  testMode?: boolean; // If true, run in preview mode without side effects
}

// Validate workflow request
export interface ValidateWorkflowRequest {
  workflow: WorkflowDefinition;
  testLeadId?: string; // Optional: test against a specific lead
}

// Clone workflow request
export interface CloneWorkflowRequest {
  name?: string; // Optional custom name (defaults to "Copy of {original name}")
}

// Workflow list response
export interface WorkflowListResponse {
  workflows: WorkflowListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Workflow list item (summary)
export interface WorkflowListItem {
  id: string;
  name: string;
  description?: string;
  triggerType: WorkflowTriggerType;
  enabled: boolean;
  stats: {
    runs: number;
    success: number;
    failed: number;
  };
  createdAt: string;
  updatedAt: string;
  lastExecutionAt?: string;
}

// Workflow execution response
export interface WorkflowExecutionResponse {
  executionId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  message: string;
  startedAt: string;
}
