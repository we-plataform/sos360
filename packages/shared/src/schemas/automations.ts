import { z } from 'zod';

export const automationActionTypeSchema = z.enum([
    'connection_request',
    'send_message',
    'move_pipeline_stage'
]);

export const automationActionSchema = z.object({
    type: automationActionTypeSchema,
    config: z.object({
        template: z.string().optional(), // For connection note or message content
        pipelineStageId: z.string().optional(), // For move_pipeline_stage
        delay: z.number().min(0).max(3600).optional(), // Delay in seconds
    }).refine(() => {
        // Custom validation logic based on type could go here if we had access to the parent type
        return true;
    }),
});

export const upsertAutomationSchema = z.object({
    pipelineStageId: z.string(),
    name: z.string().min(1),
    actions: z.array(automationActionSchema),
    enabled: z.boolean().default(true),
});
