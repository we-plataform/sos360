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
import { Clock } from 'lucide-react';
import type { BaseNodeData } from './types';

interface DelayNodeProps {
  data: BaseNodeData & {
    type: 'delay';
  };
  selected?: boolean;
}

const DELAY_UNITS = [
  { value: 'seconds', label: 'Seconds', multiplier: 1 },
  { value: 'minutes', label: 'Minutes', multiplier: 60 },
  { value: 'hours', label: 'Hours', multiplier: 3600 },
  { value: 'days', label: 'Days', multiplier: 86400 },
];

export const DelayNode = memo(({ data, selected }: DelayNodeProps) => {
  const config = data.config || {};

  const handleConfigChange = (key: string, value: unknown) => {
    if (data.onConfigChange) {
      data.onConfigChange({
        ...config,
        [key]: value,
      });
    }
  };

  const delaySeconds = (config.delaySeconds as number) || 0;
  const delayUntil = (config.delayUntil as string) || '';

  // Convert seconds to unit/value for display
  const getDelayInUnit = () => {
    if (delaySeconds >= 86400) {
      return { value: delaySeconds / 86400, unit: 'days' };
    } else if (delaySeconds >= 3600) {
      return { value: delaySeconds / 3600, unit: 'hours' };
    } else if (delaySeconds >= 60) {
      return { value: delaySeconds / 60, unit: 'minutes' };
    }
    return { value: delaySeconds, unit: 'seconds' };
  };

  const { value: delayValue, unit: delayUnit } = getDelayInUnit();

  const handleDelayValueChange = (newValue: number, newUnit: string) => {
    const unitConfig = DELAY_UNITS.find((u) => u.value === newUnit);
    if (unitConfig) {
      handleConfigChange('delaySeconds', newValue * unitConfig.multiplier);
    }
  };

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-orange-500 !border-2 !border-orange-700"
      />
      <Card
        className={`min-w-[280px] max-w-[380px] transition-all ${
          selected ? 'ring-2 ring-orange-500 ring-offset-2' : ''
        } border-orange-500 bg-orange-50`}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-orange-600" />
            <span>{data.label}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs mb-2 block">Delay Type</Label>
            <Select
              value={delayUntil ? 'specific' : 'duration'}
              onValueChange={(val: string) => {
                if (val === 'duration') {
                  handleConfigChange('delayUntil', '');
                } else {
                  handleConfigChange('delaySeconds', 0);
                }
              }}
            >
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="duration">For Duration</SelectItem>
                <SelectItem value="specific">Until Specific Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!delayUntil ? (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label htmlFor="delayValue" className="text-xs">
                  Duration
                </Label>
                <Input
                  id="delayValue"
                  type="number"
                  value={delayValue}
                  onChange={(e) =>
                    handleDelayValueChange(parseInt(e.target.value) || 0, delayUnit)
                  }
                  min="0"
                  className="text-xs"
                />
              </div>
              <div className="w-32">
                <Label htmlFor="delayUnit" className="text-xs">
                  Unit
                </Label>
                <Select
                  value={delayUnit}
                  onValueChange={(val: string) =>
                    handleDelayValueChange(delayValue, val)
                  }
                >
                  <SelectTrigger id="delayUnit" className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELAY_UNITS.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value} className="text-xs">
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="delayUntil" className="text-xs">
                Wait Until
              </Label>
              <Input
                id="delayUntil"
                type="datetime-local"
                value={delayUntil}
                onChange={(e) => handleConfigChange('delayUntil', e.target.value)}
                className="text-xs"
              />
            </div>
          )}
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-orange-500 !border-2 !border-orange-700"
      />
    </>
  );
});

DelayNode.displayName = 'DelayNode';
