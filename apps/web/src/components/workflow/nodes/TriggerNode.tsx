import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Zap, Clock, Play } from 'lucide-react';
import type { BaseNodeData } from './types';
import type { NodeType } from '@lia360/shared';

interface TriggerNodeProps {
  data: BaseNodeData & {
    type: NodeType & `trigger_${string}`;
  };
  selected?: boolean;
}

export const TriggerNode = memo(({ data, selected }: TriggerNodeProps) => {
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
      case 'trigger_lead_stage_entry':
        return (
          <div className="space-y-2">
            <div>
              <Label htmlFor="pipelineStageId" className="text-xs">
                Pipeline Stage
              </Label>
              <Input
                id="pipelineStageId"
                value={(config.pipelineStageId as string) || ''}
                onChange={(e) => handleConfigChange('pipelineStageId', e.target.value)}
                placeholder="Enter stage ID..."
                className="text-xs"
              />
            </div>
          </div>
        );

      case 'trigger_lead_score_change':
        return (
          <div className="space-y-2">
            <div>
              <Label htmlFor="scoreThreshold" className="text-xs">
                Score Threshold
              </Label>
              <Input
                id="scoreThreshold"
                type="number"
                value={(config.scoreThreshold as number) || ''}
                onChange={(e) => handleConfigChange('scoreThreshold', parseInt(e.target.value) || 0)}
                placeholder="Enter score threshold..."
                className="text-xs"
              />
            </div>
            <div>
              <Label htmlFor="scoreOperator" className="text-xs">
                Condition
              </Label>
              <Select
                value={(config.scoreOperator as string) || 'gte'}
                onValueChange={(val: string) => handleConfigChange('scoreOperator', val)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eq">Equals</SelectItem>
                  <SelectItem value="gt">Greater Than</SelectItem>
                  <SelectItem value="gte">Greater Than or Equal</SelectItem>
                  <SelectItem value="lt">Less Than</SelectItem>
                  <SelectItem value="lte">Less Than or Equal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'trigger_lead_field_change':
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
                placeholder="e.g., status, stage..."
                className="text-xs"
              />
            </div>
            <div>
              <Label htmlFor="fieldValue" className="text-xs">
                Field Value (optional)
              </Label>
              <Input
                id="fieldValue"
                value={(config.fieldValue as string) || ''}
                onChange={(e) => handleConfigChange('fieldValue', e.target.value)}
                placeholder="Specific value to match..."
                className="text-xs"
              />
            </div>
          </div>
        );

      case 'trigger_time_based':
        return (
          <div className="space-y-2">
            <div>
              <Label htmlFor="scheduledTime" className="text-xs">
                Scheduled Time
              </Label>
              <Input
                id="scheduledTime"
                type="datetime-local"
                value={(config.scheduledTime as string) || ''}
                onChange={(e) => handleConfigChange('scheduledTime', e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <Label htmlFor="recurrence" className="text-xs">
                Recurrence
              </Label>
              <Select
                value={(config.recurrence as string) || 'once'}
                onValueChange={(val: string) => handleConfigChange('recurrence', val)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">One-time</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'trigger_webhook':
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
                placeholder="https://your-domain.com/webhook..."
                className="text-xs"
              />
            </div>
            <div>
              <Label htmlFor="webhookSecret" className="text-xs">
                Webhook Secret (optional)
              </Label>
              <Input
                id="webhookSecret"
                type="password"
                value={(config.webhookSecret as string) || ''}
                onChange={(e) => handleConfigChange('webhookSecret', e.target.value)}
                placeholder="For signature verification..."
                className="text-xs"
              />
            </div>
          </div>
        );

      case 'trigger_manual':
        return (
          <div className="space-y-2">
            <p className="text-xs text-gray-600">
              This workflow is triggered manually by a user.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const getIcon = () => {
    if (data.type === 'trigger_time_based') {
      return <Clock className="h-4 w-4 text-yellow-600" />;
    }
    if (data.type === 'trigger_manual') {
      return <Play className="h-4 w-4 text-yellow-600" />;
    }
    return <Zap className="h-4 w-4 text-yellow-600" />;
  };

  return (
    <>
      <Card
        className={`min-w-[280px] max-w-[380px] transition-all ${
          selected ? 'ring-2 ring-yellow-500 ring-offset-2' : ''
        } border-yellow-500 bg-yellow-50`}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            {getIcon()}
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
        className="!bg-yellow-500 !border-2 !border-yellow-700"
      />
    </>
  );
});

TriggerNode.displayName = 'TriggerNode';
