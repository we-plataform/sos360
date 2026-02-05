import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Types will be available from @lia360/shared once workflow types are fully exported
// For now, using inline types to avoid circular dependencies
interface WorkflowListItem {
  id: string;
  name: string;
  description?: string;
  triggerType: string;
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

interface WorkflowDefinition {
  id?: string;
  name: string;
  description?: string;
  trigger: {
    type: string;
    config: Record<string, unknown>;
  };
  nodes: any[];
  edges: any[];
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  triggerType: string;
  startedAt: string;
  completedAt?: string;
  steps: any[];
  result?: {
    success: boolean;
    message?: string;
    error?: string;
  };
}

/**
 * Hook to fetch workflows list with optional filters
 * @param params - Optional query parameters (page, limit, status, etc.)
 * @returns Query result with workflows list data
 */
export function useWorkflows(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: ['workflows', params],
    queryFn: () => api.getWorkflows(params) as Promise<{ workflows: WorkflowListItem[]; pagination: any }>,
  });
}

/**
 * Hook to fetch a single workflow by ID
 * @param id - Workflow ID
 * @param enabled - Optional boolean to control query execution (default: true)
 * @returns Query result with workflow data
 */
export function useWorkflow(id: string, enabled = true) {
  return useQuery({
    queryKey: ['workflow', id],
    queryFn: () => api.getWorkflow(id) as Promise<WorkflowDefinition>,
    enabled: enabled && !!id,
  });
}

/**
 * Hook to fetch workflow executions
 * @param id - Workflow ID
 * @param params - Optional query parameters (page, limit, status, etc.)
 * @returns Query result with workflow executions data
 */
export function useWorkflowExecutions(id: string, params?: Record<string, string | number>) {
  return useQuery({
    queryKey: ['workflow', id, 'executions', params],
    queryFn: () => api.getWorkflowExecutions(id, params) as Promise<{
      executions: WorkflowExecution[];
      summary: {
        totalExecutions: number;
        successfulExecutions: number;
        failedExecutions: number;
        averageDuration?: number;
        lastExecutionAt?: string;
        successRate: number;
      };
    }>,
    enabled: !!id,
  });
}
