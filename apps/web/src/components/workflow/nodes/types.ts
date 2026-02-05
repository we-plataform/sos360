import { Position } from 'reactflow';
import type { NodeType } from '@lia360/shared';

export interface BaseNodeData {
  type: NodeType;
  label: string;
  description?: string;
  config: Record<string, unknown>;
  onConfigChange?: (config: Record<string, unknown>) => void;
}

export interface HandleConfig {
  type: 'source' | 'target';
  position: Position;
  id?: string;
}
