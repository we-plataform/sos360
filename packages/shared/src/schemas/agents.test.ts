import { describe, it, expect } from 'vitest';
import {
  agentTypeSchema,
  agentModelSchema,
  upsertAgentSchema,
  updateAgentSchema,
  agentFiltersSchema,
  generateMessageSchema
} from './agents';

describe('Agent Type Schema', () => {
  it('accepts valid agent types', () => {
    const validTypes = ['SOCIAL_SELLER', 'SDR', 'CLOSER'];

    validTypes.forEach(type => {
      const result = agentTypeSchema.safeParse(type);
      expect(result.success).toBe(true);
    });
  });

  it('rejects invalid agent types', () => {
    const invalidTypes = ['MANAGER', 'ADMIN', 'VIEWER', '', null, undefined];

    invalidTypes.forEach(type => {
      const result = agentTypeSchema.safeParse(type);
      expect(result.success).toBe(false);
    });
  });
});

describe('Agent Model Schema', () => {
  it('accepts valid agent models', () => {
    const validModels = ['gpt-4o-mini', 'gpt-4o'];

    validModels.forEach(model => {
      const result = agentModelSchema.safeParse(model);
      expect(result.success).toBe(true);
    });
  });

  it('rejects invalid agent models', () => {
    const invalidModels = ['gpt-3.5-turbo', 'gpt-4', 'claude-3', '', null, undefined];

    invalidModels.forEach(model => {
      const result = agentModelSchema.safeParse(model);
      expect(result.success).toBe(false);
    });
  });
});

describe('Upsert Agent Schema', () => {
  describe('Valid Agent Creation', () => {
    it('accepts complete agent with all fields', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Test Agent',
        type: 'SOCIAL_SELLER',
        systemPrompt: 'You are a helpful assistant',
        temperature: 0.7,
        maxTokens: 1000,
        model: 'gpt-4o-mini',
        enabled: true,
      });

      expect(result.success).toBe(true);
    });

    it('accepts agent with only required fields', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Minimal Agent',
        type: 'SDR',
        systemPrompt: 'You are an SDR assistant',
      });

      expect(result.success).toBe(true);
    });

    it('accepts agent with temperature set to 0', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Zero Temperature Agent',
        type: 'CLOSER',
        systemPrompt: 'You are a closer',
        temperature: 0,
      });

      expect(result.success).toBe(true);
    });

    it('accepts agent with temperature set to 2', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Max Temperature Agent',
        type: 'SOCIAL_SELLER',
        systemPrompt: 'You are a social seller',
        temperature: 2,
      });

      expect(result.success).toBe(true);
    });

    it('accepts agent with maxTokens at minimum boundary', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Min Tokens Agent',
        type: 'SDR',
        systemPrompt: 'Test prompt',
        maxTokens: 1,
      });

      expect(result.success).toBe(true);
    });

    it('accepts agent with maxTokens at maximum boundary', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Max Tokens Agent',
        type: 'CLOSER',
        systemPrompt: 'Test prompt',
        maxTokens: 4000,
      });

      expect(result.success).toBe(true);
    });

    it('accepts agent with enabled field set to false', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Disabled Agent',
        type: 'SOCIAL_SELLER',
        systemPrompt: 'Test prompt',
        enabled: false,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Required Field Validation', () => {
    it('rejects agent without name', () => {
      const result = upsertAgentSchema.safeParse({
        type: 'SOCIAL_SELLER',
        systemPrompt: 'Test prompt',
      });

      expect(result.success).toBe(false);
    });

    it('rejects agent without type', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Test Agent',
        systemPrompt: 'Test prompt',
      });

      expect(result.success).toBe(false);
    });

    it('rejects agent without systemPrompt', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Test Agent',
        type: 'SOCIAL_SELLER',
      });

      expect(result.success).toBe(false);
    });

    it('rejects agent with empty name', () => {
      const result = upsertAgentSchema.safeParse({
        name: '',
        type: 'SOCIAL_SELLER',
        systemPrompt: 'Test prompt',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message);
        expect(errorMessages).toContain('Nome do agente é obrigatório');
      }
    });

    it('rejects agent with empty systemPrompt', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Test Agent',
        type: 'SOCIAL_SELLER',
        systemPrompt: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message);
        expect(errorMessages).toContain('Prompt do sistema é obrigatório');
      }
    });
  });

  describe('Name Field Validation', () => {
    it('rejects name exceeding maximum length', () => {
      const longName = 'A'.repeat(201);
      const result = upsertAgentSchema.safeParse({
        name: longName,
        type: 'SOCIAL_SELLER',
        systemPrompt: 'Test prompt',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message);
        expect(errorMessages.some(msg => msg.includes('no máximo 200 caracteres'))).toBe(true);
      }
    });

    it('accepts name at maximum length boundary', () => {
      const maxName = 'A'.repeat(200);
      const result = upsertAgentSchema.safeParse({
        name: maxName,
        type: 'SDR',
        systemPrompt: 'Test prompt',
      });

      expect(result.success).toBe(true);
    });

    it('rejects non-string name', () => {
      const result = upsertAgentSchema.safeParse({
        name: 123,
        type: 'SOCIAL_SELLER',
        systemPrompt: 'Test prompt',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('System Prompt Field Validation', () => {
    it('rejects systemPrompt exceeding maximum length', () => {
      const longPrompt = 'A'.repeat(10001);
      const result = upsertAgentSchema.safeParse({
        name: 'Test Agent',
        type: 'SOCIAL_SELLER',
        systemPrompt: longPrompt,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message);
        expect(errorMessages.some(msg => msg.includes('no máximo 10000 caracteres'))).toBe(true);
      }
    });

    it('accepts systemPrompt at maximum length boundary', () => {
      const maxPrompt = 'A'.repeat(10000);
      const result = upsertAgentSchema.safeParse({
        name: 'Test Agent',
        type: 'SDR',
        systemPrompt: maxPrompt,
      });

      expect(result.success).toBe(true);
    });

    it('rejects non-string systemPrompt', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Test Agent',
        type: 'SOCIAL_SELLER',
        systemPrompt: 123,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Temperature Field Validation', () => {
    it('rejects negative temperature', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Test Agent',
        type: 'SOCIAL_SELLER',
        systemPrompt: 'Test prompt',
        temperature: -0.1,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message);
        expect(errorMessages.some(msg => msg.includes('no mínimo 0'))).toBe(true);
      }
    });

    it('rejects temperature exceeding maximum', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Test Agent',
        type: 'SDR',
        systemPrompt: 'Test prompt',
        temperature: 2.1,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message);
        expect(errorMessages.some(msg => msg.includes('no máximo 2'))).toBe(true);
      }
    });

    it('accepts decimal temperature values', () => {
      const validTemperatures = [0.5, 0.7, 1.2, 1.8];

      validTemperatures.forEach(temperature => {
        const result = upsertAgentSchema.safeParse({
          name: 'Test Agent',
          type: 'CLOSER',
          systemPrompt: 'Test prompt',
          temperature,
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Max Tokens Field Validation', () => {
    it('rejects maxTokens below minimum', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Test Agent',
        type: 'SOCIAL_SELLER',
        systemPrompt: 'Test prompt',
        maxTokens: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message);
        expect(errorMessages.some(msg => msg.includes('no mínimo 1'))).toBe(true);
      }
    });

    it('rejects maxTokens exceeding maximum', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Test Agent',
        type: 'SDR',
        systemPrompt: 'Test prompt',
        maxTokens: 4001,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message);
        expect(errorMessages.some(msg => msg.includes('no máximo 4000'))).toBe(true);
      }
    });

    it('rejects non-integer maxTokens', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Test Agent',
        type: 'CLOSER',
        systemPrompt: 'Test prompt',
        maxTokens: 100.5,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message);
        expect(errorMessages.some(msg => msg.includes('Expected integer'))).toBe(true);
      }
    });
  });

  describe('Model Field Validation', () => {
    it('rejects invalid model', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Test Agent',
        type: 'SOCIAL_SELLER',
        systemPrompt: 'Test prompt',
        model: 'gpt-3.5-turbo',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Type Field Validation', () => {
    it('rejects invalid agent type', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Test Agent',
        type: 'INVALID_TYPE',
        systemPrompt: 'Test prompt',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Enabled Field Validation', () => {
    it('rejects non-boolean enabled field', () => {
      const result = upsertAgentSchema.safeParse({
        name: 'Test Agent',
        type: 'SOCIAL_SELLER',
        systemPrompt: 'Test prompt',
        enabled: 'true',
      });

      expect(result.success).toBe(false);
    });
  });
});

describe('Update Agent Schema', () => {
  it('accepts partial updates with single field', () => {
    const result = updateAgentSchema.safeParse({
      name: 'Updated Name',
    });

    expect(result.success).toBe(true);
  });

  it('accepts partial updates with multiple fields', () => {
    const result = updateAgentSchema.safeParse({
      name: 'Updated Name',
      enabled: false,
      temperature: 1.5,
    });

    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    const result = updateAgentSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it('accepts all fields in update', () => {
    const result = updateAgentSchema.safeParse({
      name: 'Fully Updated Agent',
      type: 'SDR',
      systemPrompt: 'Updated prompt',
      temperature: 0.8,
      maxTokens: 2000,
      model: 'gpt-4o',
      enabled: false,
    });

    expect(result.success).toBe(true);
  });

  it('validates name when provided', () => {
    const result = updateAgentSchema.safeParse({
      name: '',
    });

    expect(result.success).toBe(false);
  });

  it('validates type when provided', () => {
    const result = updateAgentSchema.safeParse({
      type: 'INVALID_TYPE',
    });

    expect(result.success).toBe(false);
  });

  it('validates systemPrompt when provided', () => {
    const result = updateAgentSchema.safeParse({
      systemPrompt: '',
    });

    expect(result.success).toBe(false);
  });
});

describe('Agent Filters Schema', () => {
  describe('Valid Filter Combinations', () => {
    it('accepts filters with only pagination', () => {
      const result = agentFiltersSchema.safeParse({
        page: 1,
        limit: 10,
      });

      expect(result.success).toBe(true);
    });

    it('accepts filters with type filter', () => {
      const result = agentFiltersSchema.safeParse({
        type: 'SOCIAL_SELLER',
      });

      expect(result.success).toBe(true);
    });

    it('accepts filters with enabled filter', () => {
      const result = agentFiltersSchema.safeParse({
        enabled: true,
      });

      expect(result.success).toBe(true);
    });

    it('accepts filters with search filter', () => {
      const result = agentFiltersSchema.safeParse({
        search: 'test agent',
      });

      expect(result.success).toBe(true);
    });

    it('accepts filters with sort and order', () => {
      const result = agentFiltersSchema.safeParse({
        sort: 'name',
        order: 'asc',
      });

      expect(result.success).toBe(true);
    });

    it('accepts filters with all fields', () => {
      const result = agentFiltersSchema.safeParse({
        page: 1,
        limit: 20,
        type: 'SDR',
        enabled: true,
        search: 'search term',
        sort: 'createdAt',
        order: 'desc',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Type Filter Validation', () => {
    it('rejects invalid type filter', () => {
      const result = agentFiltersSchema.safeParse({
        type: 'INVALID_TYPE',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Enabled Filter Validation', () => {
    it('accepts boolean true', () => {
      const result = agentFiltersSchema.safeParse({
        enabled: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
      }
    });

    it('accepts boolean false', () => {
      const result = agentFiltersSchema.safeParse({
        enabled: false,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(false);
      }
    });

    it('coerces string "true" to boolean true', () => {
      const result = agentFiltersSchema.safeParse({
        enabled: 'true',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
      }
    });

    it('coerces non-empty string "false" to boolean true', () => {
      const result = agentFiltersSchema.safeParse({
        enabled: 'false',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
      }
    });

    it('coerces empty string to boolean false', () => {
      const result = agentFiltersSchema.safeParse({
        enabled: '',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(false);
      }
    });
  });

  describe('Search Filter Validation', () => {
    it('accepts search term at maximum length', () => {
      const maxSearch = 'A'.repeat(200);
      const result = agentFiltersSchema.safeParse({
        search: maxSearch,
      });

      expect(result.success).toBe(true);
    });

    it('rejects search term exceeding maximum length', () => {
      const longSearch = 'A'.repeat(201);
      const result = agentFiltersSchema.safeParse({
        search: longSearch,
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-string search', () => {
      const result = agentFiltersSchema.safeParse({
        search: 123,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Sort Field Validation', () => {
    it('accepts valid sort fields', () => {
      const validSortFields = ['name', 'type', 'createdAt', 'updatedAt'];

      validSortFields.forEach(sort => {
        const result = agentFiltersSchema.safeParse({ sort });
        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid sort field', () => {
      const result = agentFiltersSchema.safeParse({
        sort: 'invalidField',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Order Field Validation', () => {
    it('accepts "asc" order', () => {
      const result = agentFiltersSchema.safeParse({
        order: 'asc',
      });

      expect(result.success).toBe(true);
    });

    it('accepts "desc" order', () => {
      const result = agentFiltersSchema.safeParse({
        order: 'desc',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid order', () => {
      const result = agentFiltersSchema.safeParse({
        order: 'invalid',
      });

      expect(result.success).toBe(false);
    });
  });
});

describe('Generate Message Schema', () => {
  describe('Valid Message Generation', () => {
    it('accepts complete request with all fields', () => {
      const result = generateMessageSchema.safeParse({
        agentId: 'agent-123',
        leadId: 'lead-456',
        messageType: 'connection_request',
        context: 'Additional context here',
      });

      expect(result.success).toBe(true);
    });

    it('accepts request with only required fields', () => {
      const result = generateMessageSchema.safeParse({
        agentId: 'agent-123',
        leadId: 'lead-456',
      });

      expect(result.success).toBe(true);
    });

    it('accepts all valid message types', () => {
      const validMessageTypes = ['connection_request', 'first_message', 'follow_up'];

      validMessageTypes.forEach(messageType => {
        const result = generateMessageSchema.safeParse({
          agentId: 'agent-123',
          leadId: 'lead-456',
          messageType,
        });

        expect(result.success).toBe(true);
      });
    });

    it('accepts context at maximum length', () => {
      const maxContext = 'A'.repeat(2000);
      const result = generateMessageSchema.safeParse({
        agentId: 'agent-123',
        leadId: 'lead-456',
        context: maxContext,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Required Field Validation', () => {
    it('rejects request without agentId', () => {
      const result = generateMessageSchema.safeParse({
        leadId: 'lead-456',
      });

      expect(result.success).toBe(false);
    });

    it('rejects request without leadId', () => {
      const result = generateMessageSchema.safeParse({
        agentId: 'agent-123',
      });

      expect(result.success).toBe(false);
    });

    it('rejects request with empty agentId', () => {
      const result = generateMessageSchema.safeParse({
        agentId: '',
        leadId: 'lead-456',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message);
        expect(errorMessages).toContain('ID do agente é obrigatório');
      }
    });

    it('rejects request with empty leadId', () => {
      const result = generateMessageSchema.safeParse({
        agentId: 'agent-123',
        leadId: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message);
        expect(errorMessages).toContain('ID do lead é obrigatório');
      }
    });
  });

  describe('Agent ID Field Validation', () => {
    it('rejects non-string agentId', () => {
      const result = generateMessageSchema.safeParse({
        agentId: 123,
        leadId: 'lead-456',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Lead ID Field Validation', () => {
    it('rejects non-string leadId', () => {
      const result = generateMessageSchema.safeParse({
        agentId: 'agent-123',
        leadId: 456,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Message Type Field Validation', () => {
    it('rejects invalid messageType', () => {
      const result = generateMessageSchema.safeParse({
        agentId: 'agent-123',
        leadId: 'lead-456',
        messageType: 'invalid_type',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Context Field Validation', () => {
    it('rejects context exceeding maximum length', () => {
      const longContext = 'A'.repeat(2001);
      const result = generateMessageSchema.safeParse({
        agentId: 'agent-123',
        leadId: 'lead-456',
        context: longContext,
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-string context', () => {
      const result = generateMessageSchema.safeParse({
        agentId: 'agent-123',
        leadId: 'lead-456',
        context: 123,
      });

      expect(result.success).toBe(false);
    });
  });
});
