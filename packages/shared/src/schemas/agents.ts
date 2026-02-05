import { z } from 'zod';
import { paginationSchema } from './base';

// Agent type enum
export const agentTypeSchema = z.enum([
    'SOCIAL_SELLER',
    'SDR',
    'CLOSER'
]);

// Agent model enum for validation
export const agentModelSchema = z.enum([
    'gpt-4o-mini',
    'gpt-4o'
]);

// Schema for creating/updating an agent
export const upsertAgentSchema = z.object({
    name: z.string().min(1, 'Nome do agente é obrigatório').max(200, 'Nome do agente deve ter no máximo 200 caracteres'),
    description: z.string().max(500).optional(),
    avatarUrl: z.string().url().optional(),
    type: agentTypeSchema,
    systemPrompt: z.string().min(1, 'Prompt do sistema é obrigatório').max(10000, 'Prompt do sistema deve ter no máximo 10000 caracteres'),
    temperature: z.number().min(0, 'Temperatura deve ser no mínimo 0').max(2, 'Temperatura deve ser no máximo 2').optional(),
    maxTokens: z.number().int().min(1, 'Max tokens deve ser no mínimo 1').max(4000, 'Max tokens deve ser no máximo 4000').optional(),
    model: agentModelSchema.optional(),
    enabled: z.boolean().optional(),
});

// Schema for updating an existing agent (all fields optional)
export const updateAgentSchema = upsertAgentSchema.partial();

// Agent filters for listing
export const agentFiltersSchema = paginationSchema.extend({
    type: agentTypeSchema.optional(),
    enabled: z.coerce.boolean().optional(),
    search: z.string().max(200).optional(),
    sort: z.enum(['name', 'type', 'createdAt', 'updatedAt']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
});

// Schema for AI message generation
export const generateMessageSchema = z.object({
    agentId: z.string().min(1, 'ID do agente é obrigatório'),
    leadId: z.string().min(1, 'ID do lead é obrigatório'),
    messageType: z.enum(['connection_request', 'first_message', 'follow_up']).optional(),
    context: z.string().max(2000).optional(),
});

// Type exports
export type AgentType = z.infer<typeof agentTypeSchema>;
export type AgentModel = z.infer<typeof agentModelSchema>;
export type UpsertAgent = z.infer<typeof upsertAgentSchema>;
export type UpdateAgent = z.infer<typeof updateAgentSchema>;
export type AgentFilters = z.infer<typeof agentFiltersSchema>;
export type GenerateMessage = z.infer<typeof generateMessageSchema>;
