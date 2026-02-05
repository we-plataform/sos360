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
import { Repeat } from 'lucide-react';
import type { BaseNodeData } from './types';

interface LoopNodeProps {
  data: BaseNodeData & {
    type: 'loop';
  };
  selected?: boolean;
}

const LOOP_TYPES = [
  { value: 'leads', label: 'Leads' },
  { value: 'audience', label: 'Audience' },
  { value: 'custom_list', label: 'Custom List' },
];

export const LoopNode = memo(({ data, selected }: LoopNodeProps) => {
  const config = data.config || {};

  const handleConfigChange = (key: string, value: unknown) => {
    if (data.onConfigChange) {
      data.onConfigChange({
        ...config,
        [key]: value,
      });
    }
  };

  const loopType = (config.loopType as string) || 'leads';
  const loopList = (config.loopList as string[]) || [];
  const maxIterations = (config.maxIterations as number) || 100;

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-green-500 !border-2 !border-green-700"
      />
      <Card
        className={`min-w-[300px] max-w-[400px] transition-all ${
          selected ? 'ring-2 ring-green-500 ring-offset-2' : ''
        } border-green-500 bg-green-50`}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Repeat className="h-4 w-4 text-green-600" />
            <span>{data.label}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="loopType" className="text-xs">
              Loop Type
            </Label>
            <Select
              value={loopType}
              onValueChange={(val: string) => handleConfigChange('loopType', val)}
            >
              <SelectTrigger id="loopType" className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOOP_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="text-xs">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loopType === 'audience' && (
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
          )}

          {loopType === 'custom_list' && (
            <div>
              <Label htmlFor="loopList" className="text-xs">
                Items (comma-separated)
              </Label>
              <Input
                id="loopList"
                value={loopList.join(', ')}
                onChange={(e) =>
                  handleConfigChange(
                    'loopList',
                    e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                  )
                }
                placeholder="item1, item2, item3..."
                className="text-xs"
              />
              <p className="text-xs text-gray-500 mt-1">
                {loopList.length} item(s) in list
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="maxIterations" className="text-xs">
              Max Iterations
            </Label>
            <Input
              id="maxIterations"
              type="number"
              value={maxIterations}
              onChange={(e) =>
                handleConfigChange('maxIterations', parseInt(e.target.value) || 100)
              }
              min="1"
              max="1000"
              className="text-xs"
            />
            <p className="text-xs text-gray-500 mt-1">
              Prevents infinite loops (max: 1000)
            </p>
          </div>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Right}
        id="loop"
        className="!bg-green-500 !border-2 !border-green-700 !top-1/3"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="complete"
        className="!bg-blue-500 !border-2 !border-blue-700 !left-1/2"
      />
    </>
  );
});

LoopNode.displayName = 'LoopNode';
