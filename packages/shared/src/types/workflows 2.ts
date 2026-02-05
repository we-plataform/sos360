export type WorkflowStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'archived';

export type NodeType =
  // Triggers - start of workflow
  | 'trigger_lead_stage_entry'
  | 'trigger_lead_score_change'
  | 'trigger_lead_field_change'
  | 'trigger_time_based'
  | 'trigger_webhook'
  | 'trigger_manual'
  // Actions - things to do
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
  // Flow control
  | 'condition'
  | 'delay'
  | 'loop'
  | 'end';

export type WorkflowTestRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export interface NodePosition {
  x: number;
  y: number;
}

export interface WorkflowStats {
  runs: number;
  success: number;
  failed: number;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  isTemplate: boolean;
  stats: WorkflowStats;
  createdAt: string;
  updatedAt: string;
  workspaceId: string;
  createdById: string;
  createdBy?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  testRuns?: WorkflowTestRun[];
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  config: Record<string, unknown>;
  position: NodePosition;
  createdAt: string;
  updatedAt: string;
  workflowId: string;
}

export interface WorkflowEdge {
  id: string;
  config: Record<string, unknown>;
  createdAt: string;
  workflowId: string;
  sourceNodeId: string;
  targetNodeId: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isSystem: boolean;
  stats: {
    uses: number;
  };
  createdAt: string;
  updatedAt: string;
  workspaceId?: string;
  createdById?: string;
  createdBy?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
}

export interface WorkflowTestRun {
  id: string;
  status: WorkflowTestRunStatus;
  result: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
  workflowId: string;
  testLeadId?: string;
  testLead?: {
    id: string;
    fullName?: string;
    profileUrl?: string;
  };
}

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  nodes?: CreateWorkflowNodeRequest[];
  edges?: CreateWorkflowEdgeRequest[];
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  status?: WorkflowStatus;
  nodes?: UpdateWorkflowNodeRequest[];
  edges?: UpdateWorkflowEdgeRequest[];
}

export interface CreateWorkflowNodeRequest {
  type: NodeType;
  config?: Record<string, unknown>;
  position?: NodePosition;
}

export interface UpdateWorkflowNodeRequest {
  id: string;
  config?: Record<string, unknown>;
  position?: NodePosition;
}

export interface CreateWorkflowEdgeRequest {
  sourceNodeId: string;
  targetNodeId: string;
  config?: Record<string, unknown>;
}

export interface UpdateWorkflowEdgeRequest {
  id: string;
  config?: Record<string, unknown>;
}

export interface CreateWorkflowTemplateRequest {
  name: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  nodes: CreateWorkflowNodeRequest[];
  edges: CreateWorkflowEdgeRequest[];
}

export interface CloneWorkflowRequest {
  targetWorkspaceId: string;
  name?: string;
}

export interface TestWorkflowRequest {
  testLeadId?: string;
}

export interface WorkflowFilters {
  status?: WorkflowStatus;
  isTemplate?: boolean;
  search?: string;
  sort?: string;
}
