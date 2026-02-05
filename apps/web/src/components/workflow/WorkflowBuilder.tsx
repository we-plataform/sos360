'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  NodeTypes,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Play,
  Save,
  Plus,
  Trash2,
  Zap,
  GitBranch,
  Clock,
  Repeat,
  Flag,
} from 'lucide-react';
import type { Workflow, WorkflowNode, WorkflowEdge, NodeType } from '@lia360/shared';

interface WorkflowBuilderProps {
  workflowId?: string;
  onSave?: (workflow: Workflow) => void;
  readOnly?: boolean;
}

// Node type icons mapping
const NODE_ICONS: Record<NodeType, React.ReactNode> = {
  trigger_lead_stage_entry: <Zap className="h-4 w-4" />,
  trigger_lead_score_change: <Zap className="h-4 w-4" />,
  trigger_lead_field_change: <Zap className="h-4 w-4" />,
  trigger_time_based: <Clock className="h-4 w-4" />,
  trigger_webhook: <Zap className="h-4 w-4" />,
  trigger_manual: <Play className="h-4 w-4" />,
  action_send_message: <Plus className="h-4 w-4" />,
  action_add_tag: <Plus className="h-4 w-4" />,
  action_remove_tag: <Trash2 className="h-4 w-4" />,
  action_assign_user: <Plus className="h-4 w-4" />,
  action_change_stage: <Plus className="h-4 w-4" />,
  action_update_lead_field: <Plus className="h-4 w-4" />,
  action_enqueue_agent: <Plus className="h-4 w-4" />,
  action_send_webhook: <Plus className="h-4 w-4" />,
  action_add_to_audience: <Plus className="h-4 w-4" />,
  action_remove_from_audience: <Trash2 className="h-4 w-4" />,
  action_wait_until_time: <Clock className="h-4 w-4" />,
  action_increment_score: <Plus className="h-4 w-4" />,
  action_decrement_score: <Trash2 className="h-4 w-4" />,
  condition: <GitBranch className="h-4 w-4" />,
  delay: <Clock className="h-4 w-4" />,
  loop: <Repeat className="h-4 w-4" />,
  end: <Flag className="h-4 w-4" />,
};

// Node type labels
const NODE_LABELS: Record<NodeType, string> = {
  trigger_lead_stage_entry: 'Lead Enters Stage',
  trigger_lead_score_change: 'Score Changes',
  trigger_lead_field_change: 'Field Changes',
  trigger_time_based: 'Time Based',
  trigger_webhook: 'Webhook',
  trigger_manual: 'Manual Trigger',
  action_send_message: 'Send Message',
  action_add_tag: 'Add Tag',
  action_remove_tag: 'Remove Tag',
  action_assign_user: 'Assign User',
  action_change_stage: 'Change Stage',
  action_update_lead_field: 'Update Field',
  action_enqueue_agent: 'Enqueue AI Agent',
  action_send_webhook: 'Send Webhook',
  action_add_to_audience: 'Add to Audience',
  action_remove_from_audience: 'Remove from Audience',
  action_wait_until_time: 'Wait Until Time',
  action_increment_score: 'Increment Score',
  action_decrement_score: 'Decrement Score',
  condition: 'Condition',
  delay: 'Delay',
  loop: 'Loop',
  end: 'End',
};

// Custom node component
function CustomNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <Card
      className={`min-w-[200px] transition-all ${
        selected ? 'ring-2 ring-blue-500' : ''
      } ${
        data.type.startsWith('trigger_')
          ? 'border-yellow-500 bg-yellow-50'
          : data.type.startsWith('action_')
          ? 'border-blue-500 bg-blue-50'
          : data.type === 'condition'
          ? 'border-purple-500 bg-purple-50'
          : data.type === 'delay'
          ? 'border-orange-500 bg-orange-50'
          : data.type === 'loop'
          ? 'border-green-500 bg-green-50'
          : 'border-gray-500 bg-gray-50'
      }`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {NODE_ICONS[data.type as NodeType]}
          <span>{data.label}</span>
        </CardTitle>
      </CardHeader>
      {data.description && (
        <CardContent className="pt-0">
          <p className="text-xs text-gray-600">{data.description}</p>
        </CardContent>
      )}
    </Card>
  );
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

export function WorkflowBuilder({
  workflowId,
  onSave,
  readOnly = false,
}: WorkflowBuilderProps) {
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Load workflow data if editing
  useEffect(() => {
    if (workflowId) {
      const loadWorkflow = async () => {
        try {
          setIsLoading(true);
          const data = await api.getWorkflow(workflowId) as Workflow;
          setWorkflow(data);
          setWorkflowName(data.name);
          setWorkflowDescription(data.description || '');

          // Convert workflow nodes to React Flow nodes
          const flowNodes: Node[] = (data.nodes || []).map((node: WorkflowNode) => ({
            id: node.id,
            type: 'custom',
            position: node.position,
            data: {
              type: node.type,
              label: NODE_LABELS[node.type],
              description: getNodeDescription(node.type, node.config),
              config: node.config,
            },
          }));

          // Convert workflow edges to React Flow edges
          const flowEdges: Edge[] = (data.edges || []).map((edge: WorkflowEdge) => ({
            id: edge.id,
            source: edge.sourceNodeId,
            target: edge.targetNodeId,
            markerEnd: { type: MarkerType.ArrowClosed },
            label: edge.config.label as string | undefined,
            type: 'smoothstep',
          }));

          setNodes(flowNodes);
          setEdges(flowEdges);
        } catch (error) {
          console.error('Failed to load workflow:', error);
          toast.error('Failed to load workflow');
        } finally {
          setIsLoading(false);
        }
      };

      loadWorkflow();
    }
  }, [workflowId, setNodes, setEdges]);

  // Helper function to generate node description based on config
  function getNodeDescription(type: NodeType, config: Record<string, unknown>): string {
    switch (type) {
      case 'trigger_lead_stage_entry':
        return `Stage: ${config.pipelineStageId || 'Not set'}`;
      case 'action_send_message':
        return (config.template as string)?.substring(0, 50) || 'No message';
      case 'condition':
        return `${config.field} ${config.operator} ${config.value}`;
      case 'delay':
        return config.delaySeconds
          ? `Wait ${config.delaySeconds} seconds`
          : config.delayUntil
          ? `Until ${config.delayUntil}`
          : 'No delay configured';
      case 'loop':
        return `Iterate over ${config.iterationType || 'leads'}`;
      default:
        return '';
    }
  }

  // Generate unique ID
  const generateId = useCallback(() => {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Add node to canvas
  const addNode = useCallback(
    (nodeType: NodeType) => {
      const id = generateId();
      const newNode: Node = {
        id,
        type: 'custom',
        position: {
          x: Math.random() * 400 + 100,
          y: Math.random() * 300 + 100,
        },
        data: {
          type: nodeType,
          label: NODE_LABELS[nodeType],
          description: getNodeDescription(nodeType, {}),
          config: {},
        },
      };

      setNodes((nds) => [...nds, newNode]);
      toast.success(`Added ${NODE_LABELS[nodeType]} node`);
    },
    [generateId, setNodes]
  );

  // Cycle detection using DFS algorithm
  const wouldCreateCycle = useCallback(
    (sourceId: string, targetId: string, currentEdges: Edge[]): boolean => {
      // Build adjacency list
      const adjacency = new Map<string, string[]>();
      currentEdges.forEach((edge) => {
        const sources = adjacency.get(edge.target) || [];
        sources.push(edge.source);
        adjacency.set(edge.target, sources);
      });

      // Add the potential new edge
      const targets = adjacency.get(targetId) || [];
      targets.push(sourceId);
      adjacency.set(targetId, targets);

      // DFS to detect cycles starting from targetId
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      const hasCycle = (nodeId: string): boolean => {
        visited.add(nodeId);
        recursionStack.add(nodeId);

        const sources = adjacency.get(nodeId) || [];
        for (const source of sources) {
          if (!visited.has(source)) {
            if (hasCycle(source)) {
              return true;
            }
          } else if (recursionStack.has(source)) {
            return true;
          }
        }

        recursionStack.delete(nodeId);
        return false;
      };

      return hasCycle(targetId);
    },
    []
  );

  // Validate node type compatibility
  const isNodeTypeCompatible = useCallback((sourceType: string, targetType: string): boolean => {
    // End nodes cannot have outgoing connections
    if (sourceType === 'end') {
      return false;
    }

    // Triggers can only connect to actions or flow control nodes
    if (sourceType.startsWith('trigger_')) {
      return (
        targetType.startsWith('action_') ||
        targetType === 'condition' ||
        targetType === 'delay' ||
        targetType === 'loop' ||
        targetType === 'end'
      );
    }

    // Actions can connect to other actions, flow control, or end
    if (sourceType.startsWith('action_')) {
      return (
        targetType.startsWith('action_') ||
        targetType === 'condition' ||
        targetType === 'delay' ||
        targetType === 'loop' ||
        targetType === 'end'
      );
    }

    // Flow control nodes
    if (sourceType === 'condition') {
      return (
        targetType.startsWith('action_') ||
        targetType === 'condition' ||
        targetType === 'delay' ||
        targetType === 'loop' ||
        targetType === 'end'
      );
    }

    if (sourceType === 'delay' || sourceType === 'loop') {
      return (
        targetType.startsWith('action_') ||
        targetType === 'condition' ||
        targetType === 'delay' ||
        targetType === 'loop' ||
        targetType === 'end'
      );
    }

    // Default: allow connection
    return true;
  }, []);

  // ReactFlow connection validation
  const isValidConnection = useCallback(
    (connection: Connection) => {
      // Check for null/undefined source or target
      if (!connection.source || !connection.target) {
        toast.error('Invalid connection');
        return false;
      }

      // Prevent self-loops
      if (connection.source === connection.target) {
        toast.error('Cannot connect node to itself');
        return false;
      }

      // Prevent cycles
      if (wouldCreateCycle(connection.source, connection.target, edges)) {
        toast.error('Cannot create cycles in workflow');
        return false;
      }

      // Validate node types
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) {
        toast.error('Invalid node connection');
        return false;
      }

      if (!isNodeTypeCompatible(sourceNode.data.type, targetNode.data.type)) {
        const sourceLabel = NODE_LABELS[sourceNode.data.type as NodeType] || sourceNode.data.type;
        const targetLabel = NODE_LABELS[targetNode.data.type as NodeType] || targetNode.data.type;
        toast.error(`${sourceLabel} cannot connect to ${targetLabel}`);
        return false;
      }

      // Prevent multiple outputs from trigger nodes
      if (sourceNode.data.type?.startsWith('trigger_')) {
        const existingConnections = edges.filter((e) => e.source === connection.source);
        if (existingConnections.length > 0) {
          toast.error('Trigger nodes can only have one output');
          return false;
        }
      }

      // Prevent multiple incoming connections to trigger nodes
      if (targetNode.data.type?.startsWith('trigger_')) {
        const existingInputs = edges.filter((e) => e.target === connection.target);
        if (existingInputs.length > 0) {
          toast.error('Trigger nodes cannot have incoming connections');
          return false;
        }
      }

      return true;
    },
    [nodes, edges, wouldCreateCycle, isNodeTypeCompatible]
  );

  // Handle node connections
  const onConnect = useCallback(
    (connection: Connection) => {
      // Validate connection using isValidConnection
      if (!isValidConnection(connection)) {
        return;
      }

      const edge = {
        ...connection,
        markerEnd: { type: MarkerType.ArrowClosed },
        type: 'smoothstep' as const,
      };

      setEdges((eds) => addEdge({ ...edge, id: `edge_${Date.now()}` }, eds));
    },
    [isValidConnection, setEdges]
  );

  // Remove node
  const removeNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      toast.success('Node removed');
    },
    [setNodes, setEdges]
  );

  // Save workflow
  const handleSave = useCallback(async () => {
    if (readOnly) return;

    setIsLoading(true);
    try {
      // Convert React Flow nodes to workflow nodes
      const workflowNodes: WorkflowNode[] = nodes.map((node) => ({
        id: node.id,
        type: node.data.type,
        config: node.data.config || {},
        position: node.position,
        createdAt: workflow?.nodes?.find((n) => n.id === node.id)?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workflowId: workflowId || '',
      }));

      // Convert React Flow edges to workflow edges
      const workflowEdges: WorkflowEdge[] = edges.map((edge) => ({
        id: edge.id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        config: { label: edge.label },
        createdAt: workflow?.edges?.find((e) => e.id === edge.id)?.createdAt || new Date().toISOString(),
        workflowId: workflowId || '',
      }));

      const workflowData = {
        name: workflowName,
        description: workflowDescription,
        nodes: workflowNodes,
        edges: workflowEdges,
      };

      // Create or update workflow depending on whether workflowId exists
      const data = workflowId
        ? await api.updateWorkflow(workflowId, workflowData) as Workflow
        : await api.createWorkflow(workflowData) as Workflow;

      setWorkflow(data);
      onSave?.(data);
      toast.success('Workflow saved successfully!');
    } catch (error) {
      console.error('Failed to save workflow:', error);
      toast.error('Failed to save workflow');
    } finally {
      setIsLoading(false);
    }
  }, [nodes, edges, workflowName, workflowDescription, workflowId, workflow, readOnly, onSave]);

  // Node palette grouped by type
  const nodePalette = useMemo(() => {
    return {
      triggers: [
        { type: 'trigger_lead_stage_entry' as NodeType, label: 'Lead Enters Stage' },
        { type: 'trigger_lead_score_change' as NodeType, label: 'Score Changes' },
        { type: 'trigger_lead_field_change' as NodeType, label: 'Field Changes' },
        { type: 'trigger_time_based' as NodeType, label: 'Time Based' },
        { type: 'trigger_webhook' as NodeType, label: 'Webhook' },
        { type: 'trigger_manual' as NodeType, label: 'Manual Trigger' },
      ],
      actions: [
        { type: 'action_send_message' as NodeType, label: 'Send Message' },
        { type: 'action_add_tag' as NodeType, label: 'Add Tag' },
        { type: 'action_remove_tag' as NodeType, label: 'Remove Tag' },
        { type: 'action_assign_user' as NodeType, label: 'Assign User' },
        { type: 'action_change_stage' as NodeType, label: 'Change Stage' },
        { type: 'action_update_lead_field' as NodeType, label: 'Update Field' },
        { type: 'action_enqueue_agent' as NodeType, label: 'Enqueue AI Agent' },
        { type: 'action_send_webhook' as NodeType, label: 'Send Webhook' },
        { type: 'action_add_to_audience' as NodeType, label: 'Add to Audience' },
        { type: 'action_remove_from_audience' as NodeType, label: 'Remove from Audience' },
        { type: 'action_wait_until_time' as NodeType, label: 'Wait Until Time' },
        { type: 'action_increment_score' as NodeType, label: 'Increment Score' },
        { type: 'action_decrement_score' as NodeType, label: 'Decrement Score' },
      ],
      flowControl: [
        { type: 'condition' as NodeType, label: 'Condition' },
        { type: 'delay' as NodeType, label: 'Delay' },
        { type: 'loop' as NodeType, label: 'Loop' },
        { type: 'end' as NodeType, label: 'End' },
      ],
    };
  }, []);

  if (isLoading && !workflow) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Node Palette Sidebar */}
      <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Node Palette</h2>

        <div className="space-y-4">
          {/* Triggers */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Triggers</Label>
            <div className="space-y-2">
              {nodePalette.triggers.map((node) => (
                <Button
                  key={node.type}
                  variant="outline"
                  className="w-full justify-start text-left"
                  size="sm"
                  onClick={() => addNode(node.type)}
                  disabled={readOnly}
                >
                  <Zap className="mr-2 h-4 w-4 text-yellow-600" />
                  {node.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Actions</Label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {nodePalette.actions.map((node) => (
                <Button
                  key={node.type}
                  variant="outline"
                  className="w-full justify-start text-left"
                  size="sm"
                  onClick={() => addNode(node.type)}
                  disabled={readOnly}
                >
                  <Plus className="mr-2 h-4 w-4 text-blue-600" />
                  {node.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Flow Control */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Flow Control</Label>
            <div className="space-y-2">
              {nodePalette.flowControl.map((node) => (
                <Button
                  key={node.type}
                  variant="outline"
                  className="w-full justify-start text-left"
                  size="sm"
                  onClick={() => addNode(node.type)}
                  disabled={readOnly}
                >
                  {node.type === 'condition' && <GitBranch className="mr-2 h-4 w-4 text-purple-600" />}
                  {node.type === 'delay' && <Clock className="mr-2 h-4 w-4 text-orange-600" />}
                  {node.type === 'loop' && <Repeat className="mr-2 h-4 w-4 text-green-600" />}
                  {node.type === 'end' && <Flag className="mr-2 h-4 w-4 text-gray-600" />}
                  {node.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Node Info */}
        {nodes.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-medium mb-2">Workflow Stats</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p>Total Nodes: {nodes.length}</p>
              <p>Total Connections: {edges.length}</p>
              <p>
                Triggers:{' '}
                {nodes.filter((n) => n.data.type?.startsWith('trigger_')).length}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="border-b bg-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <Label htmlFor="workflow-name" className="sr-only">
                Workflow Name
              </Label>
              <Input
                id="workflow-name"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="w-64"
                placeholder="Workflow Name"
                disabled={readOnly}
              />
            </div>
            <div>
              <Label htmlFor="workflow-description" className="sr-only">
                Description
              </Label>
              <Input
                id="workflow-description"
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                className="w-96"
                placeholder="Description (optional)"
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!readOnly && (
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? (
                  'Saving...'
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Workflow
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
            deleteKeyCode="Delete"
          >
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                if (node.data.type?.startsWith('trigger_')) return '#fbbf24';
                if (node.data.type?.startsWith('action_')) return '#3b82f6';
                if (node.data.type === 'condition') return '#a855f7';
                if (node.data.type === 'delay') return '#f97316';
                if (node.data.type === 'loop') return '#22c55e';
                return '#6b7280';
              }}
              className="!bg-gray-50 !border border-gray-200"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
