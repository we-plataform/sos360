import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
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
import { Plus } from 'lucide-react';
import type { BaseNodeData } from './types';
import type { NodeType } from '@lia360/shared';

interface ActionNodeProps {
  data: BaseNodeData & {
    type: NodeType & `action_${string}`;
  };
  selected?: boolean;
}

export const ActionNode = memo(({ data, selected }: ActionNodeProps) => {
  const config = data.config || {};

  const handleConfigChange = (key: string, value: unknown) => {
    if (data.onConfigChange) {
      data.onConfigChange({
        ...config,
        [key]: value,
      });
    }
  };

  const renderConfigFields = () => {
    switch (data.type) {
      case 'action_send_message':
        return (
          <div className="space-y-2">
            <div>
              <Label htmlFor="template" className="text-xs">
                Message Template
              </Label>
              <Textarea
                id="template"
                value={(config.template as string) || ''}
                onChange={(e) => handleConfigChange('template', e.target.value)}
                placeholder="Enter message template..."
                className="text-xs"
                rows={3}
              />
            </div>
          </div>
        );

      case 'action_add_tag':
      case 'action_remove_tag':
        return (
          <div className="space-y-2">
            <div>
              <Label htmlFor="tag" className="text-xs">
                Tag Name
              </Label>
              <Input
                id="tag"
                value={(config.tag as string) || ''}
                onChange={(e) => handleConfigChange('tag', e.target.value)}
                placeholder="Enter tag name..."
                className="text-xs"
              />
            </div>
          </div>
        );

      case 'action_assign_user':
        return (
          <div className="space-y-2">
            <div>
              <Label htmlFor="assignedUserId" className="text-xs">
                Assign to User
              </Label>
              <Input
                id="assignedUserId"
                value={(config.assignedUserId as string) || ''}
                onChange={(e) => handleConfigChange('assignedUserId', e.target.value)}
                placeholder="Enter user ID..."
                className="text-xs"
              />
            </div>
          </div>
        );

      case 'action_change_stage':
        return (
          <div className="space-y-2">
            <div>
              <Label htmlFor="targetStageId" className="text-xs">
                Target Stage
              </Label>
              <Input
                id="targetStageId"
                value={(config.targetStageId as string) || ''}
                onChange={(e) => handleConfigChange('targetStageId', e.target.value)}
                placeholder="Enter stage ID..."
                className="text-xs"
              />
            </div>
          </div>
        );

      case 'action_update_lead_field':
        return (
          <div className="space-y-2">
            <div>
              <Label htmlFor="fieldName" className="text-xs">
                Field Name
              </Label>
              <Input
                id="fieldName"
                value={(config.fieldName as string) || ''}
                onChange={(e) => handleConfigChange('fieldName', e.target.value)}
                placeholder="e.g., firstName, lastName..."
                className="text-xs"
              />
            </div>
            <div>
              <Label htmlFor="fieldValue" className="text-xs">
                Field Value
              </Label>
              <Input
                id="fieldValue"
                value={(config.fieldValue as string) || ''}
                onChange={(e) => handleConfigChange('fieldValue', e.target.value)}
                placeholder="Enter value..."
                className="text-xs"
              />
            </div>
          </div>
        );

      case 'action_enqueue_agent':
        return (
          <div className="space-y-2">
            <div>
              <Label htmlFor="agentTask" className="text-xs">
                AI Agent Task
              </Label>
              <Textarea
                id="agentTask"
                value={(config.agentTask as string) || ''}
                onChange={(e) => handleConfigChange('agentTask', e.target.value)}
                placeholder="Describe the AI agent task..."
                className="text-xs"
                rows={2}
              />
            </div>
          </div>
        );

      case 'action_send_webhook':
        return (
          <div className="space-y-2">
            <div>
              <Label htmlFor="webhookUrl" className="text-xs">
                Webhook URL
              </Label>
              <Input
                id="webhookUrl"
                value={(config.webhookUrl as string) || ''}
                onChange={(e) => handleConfigChange('webhookUrl', e.target.value)}
                placeholder="https://..."
                className="text-xs"
              />
            </div>
          </div>
        );

      case 'action_add_to_audience':
      case 'action_remove_from_audience':
        return (
          <div className="space-y-2">
            <div>
              <Label htmlFor="audienceId" className="text-xs">
                Audience ID
              </Label>
              <Input
                id="audienceId"
                value={(config.audienceId as string) || ''}
                onChange={(e) => handleConfigChange('audienceId', e.target.value)}
                placeholder="Enter audience ID..."
                className="text-xs"
              />
            </div>
          </div>
        );

      case 'action_wait_until_time':
        return (
          <div className="space-y-2">
            <div>
              <Label htmlFor="waitUntil" className="text-xs">
                Wait Until
              </Label>
              <Input
                id="waitUntil"
                type="datetime-local"
                value={(config.waitUntil as string) || ''}
                onChange={(e) => handleConfigChange('waitUntil', e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
        );

      case 'action_increment_score':
      case 'action_decrement_score':
        return (
          <div className="space-y-2">
            <div>
              <Label htmlFor="scoreIncrement" className="text-xs">
                Score Change
              </Label>
              <Input
                id="scoreIncrement"
                type="number"
                value={(config.scoreIncrement as number) || 10}
                onChange={(e) => handleConfigChange('scoreIncrement', parseInt(e.target.value) || 0)}
                className="text-xs"
                min="1"
                max="100"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-blue-500 !border-2 !border-blue-700"
      />
      <Card
        className={`min-w-[250px] max-w-[350px] transition-all ${
          selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
        } border-blue-500 bg-blue-50`}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Plus className="h-4 w-4 text-blue-600" />
            <span>{data.label}</span>
          </CardTitle>
        </CardHeader>
        {data.description && (
          <CardContent className="pt-0 pb-2">
            <p className="text-xs text-gray-600">{data.description}</p>
          </CardContent>
        )}
        <CardContent className="pt-0 space-y-2">
          {renderConfigFields()}
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-500 !border-2 !border-blue-700"
      />
    </>
  );
});

ActionNode.displayName = 'ActionNode';
