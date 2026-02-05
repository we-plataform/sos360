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
import { GitBranch } from 'lucide-react';
import type { BaseNodeData } from './types';

interface ConditionNodeProps {
  data: BaseNodeData & {
    type: 'condition';
  };
  selected?: boolean;
}

const OPERATORS = [
  { value: 'eq', label: 'Equals' },
  { value: 'ne', label: 'Not Equals' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'gte', label: 'Greater Than or Equal' },
  { value: 'lt', label: 'Less Than' },
  { value: 'lte', label: 'Less Than or Equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
];

const FIELD_OPTIONS = [
  { value: 'leadScore', label: 'Lead Score' },
  { value: 'stage', label: 'Current Stage' },
  { value: 'status', label: 'Lead Status' },
  { value: 'tags', label: 'Tags' },
  { value: 'assignedUserId', label: 'Assigned User' },
  { value: 'createdAt', label: 'Created Date' },
  { value: 'updatedAt', label: 'Updated Date' },
  { value: 'fullName', label: 'Full Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone Number' },
];

export const ConditionNode = memo(({ data, selected }: ConditionNodeProps) => {
  const config = data.config || {};

  const handleConfigChange = (key: string, value: unknown) => {
    if (data.onConfigChange) {
      data.onConfigChange({
        ...config,
        [key]: value,
      });
    }
  };

  const operator = (config.conditionOperator as string) || 'eq';
  const field = (config.conditionField as string) || '';
  const value = (config.conditionValue as string) || '';

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-purple-500 !border-2 !border-purple-700"
      />
      <Card
        className={`min-w-[300px] max-w-[400px] transition-all ${
          selected ? 'ring-2 ring-purple-500 ring-offset-2' : ''
        } border-purple-500 bg-purple-50`}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <GitBranch className="h-4 w-4 text-purple-600" />
            <span>{data.label}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="conditionField" className="text-xs">
              Field
            </Label>
            <Select
              value={field}
              onValueChange={(val: string) => handleConfigChange('conditionField', val)}
            >
              <SelectTrigger id="conditionField" className="text-xs">
                <SelectValue placeholder="Select field..." />
              </SelectTrigger>
              <SelectContent>
                {FIELD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="conditionOperator" className="text-xs">
              Operator
            </Label>
            <Select
              value={operator}
              onValueChange={(val: string) => handleConfigChange('conditionOperator', val)}
            >
              <SelectTrigger id="conditionOperator" className="text-xs">
                <SelectValue placeholder="Select operator..." />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!['is_empty', 'is_not_empty'].includes(operator) && (
            <div>
              <Label htmlFor="conditionValue" className="text-xs">
                Value
              </Label>
              <Input
                id="conditionValue"
                value={value}
                onChange={(e) => handleConfigChange('conditionValue', e.target.value)}
                placeholder="Enter comparison value..."
                className="text-xs"
              />
            </div>
          )}
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="!bg-green-500 !border-2 !border-green-700 !top-1/3"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className="!bg-red-500 !border-2 !border-red-700 !top-2/3"
      />
    </>
  );
});

ConditionNode.displayName = 'ConditionNode';
