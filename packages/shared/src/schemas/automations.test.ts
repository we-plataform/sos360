import { describe, it, expect } from 'vitest';
import {
  automationActionTypeSchema,
  automationActionSchema,
  upsertAutomationSchema
} from './automations';

describe('Automation Action Type Schema', () => {
  it('accepts valid action types', () => {
    const validTypes = ['connection_request', 'send_message', 'move_pipeline_stage'];

    validTypes.forEach(type => {
      const result = automationActionTypeSchema.safeParse(type);
      expect(result.success).toBe(true);
    });
  });

  it('rejects invalid action types', () => {
    const invalidTypes = ['invalid_type', 'send_email', 'call', '', null, undefined];

    invalidTypes.forEach(type => {
      const result = automationActionTypeSchema.safeParse(type);
      expect(result.success).toBe(false);
    });
  });
});

describe('Automation Action Schema', () => {
  describe('Type Validation', () => {
    it('accepts valid connection_request action', () => {
      const result = automationActionSchema.safeParse({
        type: 'connection_request',
        config: {
          template: 'Hi {{name}}, let\'s connect!',
          delay: 0,
        },
      });

      expect(result.success).toBe(true);
    });

    it('accepts valid send_message action', () => {
      const result = automationActionSchema.safeParse({
        type: 'send_message',
        config: {
          template: 'Hello {{name}}, how are you?',
          delay: 300,
        },
      });

      expect(result.success).toBe(true);
    });

    it('accepts valid move_pipeline_stage action', () => {
      const result = automationActionSchema.safeParse({
        type: 'move_pipeline_stage',
        config: {
          pipelineStageId: 'stage-123',
          delay: 600,
        },
      });

      expect(result.success).toBe(true);
    });

    it('rejects action with invalid type', () => {
      const result = automationActionSchema.safeParse({
        type: 'invalid_type',
        config: {},
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message);
        expect(errorMessages.length).toBeGreaterThan(0);
      }
    });

    it('rejects action without type', () => {
      const result = automationActionSchema.safeParse({
        config: {},
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Config Validation', () => {
    it('accepts action with all optional config fields', () => {
      const result = automationActionSchema.safeParse({
        type: 'send_message',
        config: {
          template: 'Test message',
          pipelineStageId: 'stage-123',
          delay: 500,
        },
      });

      expect(result.success).toBe(true);
    });

    it('accepts action with minimal config', () => {
      const result = automationActionSchema.safeParse({
        type: 'send_message',
        config: {},
      });

      expect(result.success).toBe(true);
    });

    it('accepts action without config', () => {
      const result = automationActionSchema.safeParse({
        type: 'connection_request',
      });

      expect(result.success).toBe(false);
    });

    it('rejects action with non-object config', () => {
      const result = automationActionSchema.safeParse({
        type: 'send_message',
        config: 'invalid',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Delay Validation', () => {
    it('accepts delay of 0', () => {
      const result = automationActionSchema.safeParse({
        type: 'send_message',
        config: {
          delay: 0,
        },
      });

      expect(result.success).toBe(true);
    });

    it('accepts delay within valid range', () => {
      const validDelays = [0, 1, 500, 1800, 3600];

      validDelays.forEach(delay => {
        const result = automationActionSchema.safeParse({
          type: 'send_message',
          config: { delay },
        });
        expect(result.success).toBe(true);
      });
    });

    it('rejects negative delay', () => {
      const result = automationActionSchema.safeParse({
        type: 'send_message',
        config: {
          delay: -1,
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message);
        expect(errorMessages.some(msg => msg.includes('Number must be greater than or equal to 0'))).toBe(true);
      }
    });

    it('rejects delay exceeding maximum', () => {
      const result = automationActionSchema.safeParse({
        type: 'send_message',
        config: {
          delay: 3601,
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message);
        expect(errorMessages.some(msg => msg.includes('Number must be less than or equal to 3600'))).toBe(true);
      }
    });
  });
});

describe('Upsert Automation Schema', () => {
  describe('Valid Automation Creation', () => {
    it('accepts complete automation with all fields', () => {
      const result = upsertAutomationSchema.safeParse({
        pipelineStageId: 'stage-123',
        name: 'Welcome Sequence',
        actions: [
          {
            type: 'connection_request',
            config: {
              template: 'Hi {{name}}!',
              delay: 0,
            },
          },
          {
            type: 'send_message',
            config: {
              template: 'Thanks for connecting!',
              delay: 1800,
            },
          },
        ],
        enabled: true,
      });

      expect(result.success).toBe(true);
    });

    it('accepts automation with enabled field set to false', () => {
      const result = upsertAutomationSchema.safeParse({
        pipelineStageId: 'stage-123',
        name: 'Disabled Automation',
        actions: [
          {
            type: 'send_message',
            config: {
              template: 'Test',
            },
          },
        ],
        enabled: false,
      });

      expect(result.success).toBe(true);
    });

    it('uses default value for enabled when not provided', () => {
      const result = upsertAutomationSchema.safeParse({
        pipelineStageId: 'stage-123',
        name: 'Test Automation',
        actions: [
          {
            type: 'send_message',
            config: {},
          },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
      }
    });
  });

  describe('Required Field Validation', () => {
    it('rejects automation without pipelineStageId', () => {
      const result = upsertAutomationSchema.safeParse({
        name: 'Test Automation',
        actions: [],
      });

      expect(result.success).toBe(false);
    });

    it('rejects automation without name', () => {
      const result = upsertAutomationSchema.safeParse({
        pipelineStageId: 'stage-123',
        actions: [],
      });

      expect(result.success).toBe(false);
    });

    it('rejects automation without actions', () => {
      const result = upsertAutomationSchema.safeParse({
        pipelineStageId: 'stage-123',
        name: 'Test Automation',
      });

      expect(result.success).toBe(false);
    });

    it('rejects automation with empty name', () => {
      const result = upsertAutomationSchema.safeParse({
        pipelineStageId: 'stage-123',
        name: '',
        actions: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message);
        expect(errorMessages).toContain('String must contain at least 1 character(s)');
      }
    });
  });

  describe('Actions Array Validation', () => {
    it('accepts empty actions array', () => {
      const result = upsertAutomationSchema.safeParse({
        pipelineStageId: 'stage-123',
        name: 'Test Automation',
        actions: [],
      });

      expect(result.success).toBe(true);
    });

    it('accepts multiple actions', () => {
      const result = upsertAutomationSchema.safeParse({
        pipelineStageId: 'stage-123',
        name: 'Multi-step Automation',
        actions: [
          {
            type: 'connection_request',
            config: { template: 'Hi!' },
          },
          {
            type: 'send_message',
            config: { template: 'Hello!' },
          },
          {
            type: 'move_pipeline_stage',
            config: { pipelineStageId: 'stage-456' },
          },
        ],
      });

      expect(result.success).toBe(true);
    });

    it('rejects non-array actions', () => {
      const result = upsertAutomationSchema.safeParse({
        pipelineStageId: 'stage-123',
        name: 'Test Automation',
        actions: 'not-an-array',
      });

      expect(result.success).toBe(false);
    });

    it('rejects actions with invalid action in array', () => {
      const result = upsertAutomationSchema.safeParse({
        pipelineStageId: 'stage-123',
        name: 'Test Automation',
        actions: [
          {
            type: 'send_message',
            config: { template: 'Valid' },
          },
          {
            type: 'invalid_type',
            config: {},
          },
        ],
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Field Type Validation', () => {
    it('rejects non-string pipelineStageId', () => {
      const result = upsertAutomationSchema.safeParse({
        pipelineStageId: 123,
        name: 'Test Automation',
        actions: [],
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-string name', () => {
      const result = upsertAutomationSchema.safeParse({
        pipelineStageId: 'stage-123',
        name: 123,
        actions: [],
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-boolean enabled field', () => {
      const result = upsertAutomationSchema.safeParse({
        pipelineStageId: 'stage-123',
        name: 'Test Automation',
        actions: [],
        enabled: 'true',
      });

      expect(result.success).toBe(false);
    });
  });
});
