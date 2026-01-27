import { z } from 'zod';

// ============================================
// SCORING MODEL SCHEMAS
// ============================================

export const scoringCriteriaSchema = z.object({
  jobTitles: z.object({
    target: z.array(z.string()).default([]),
    exclude: z.array(z.string()).default([]),
    seniority: z.array(z.string()).default([]),
  }),
  companies: z.object({
    industries: z.array(z.string()).default([]),
    sizes: z.array(z.string()).default([]),
    excludeIndustries: z.array(z.string()).default([]),
  }),
  engagement: z.object({
    minFollowers: z.number().int().min(0).optional(),
    minConnections: z.number().int().min(0).optional(),
    hasRecentPosts: z.boolean().optional(),
  }),
  completeness: z.object({
    required: z.array(z.string()).default([]),
    bonus: z.array(z.string()).default([]),
  }),
});

export const scoringWeightsSchema = z.object({
  jobTitle: z.number().min(0).default(1.0),
  company: z.number().min(0).default(1.0),
  engagement: z.number().min(0).default(0.8),
  completeness: z.number().min(0).default(0.6),
});

export const createScoringModelSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  enabled: z.boolean().optional().default(true),
  criteria: scoringCriteriaSchema,
  weights: scoringWeightsSchema,
  thresholdHigh: z.number().int().min(0).max(100).default(80),
  thresholdMedium: z.number().int().min(0).max(100).default(50),
  systemPrompt: z.string().max(5000).optional(),
});

export const updateScoringModelSchema = createScoringModelSchema.partial();

export const rescoreLeadSchema = z.object({
  force: z.boolean().optional().default(false),
});

export const batchRescoreSchema = z.object({
  pipelineId: z.string().optional(),
  leadIds: z.array(z.string()).min(1).max(1000).optional(),
  enrichAfterScore: z.boolean().optional().default(false),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type ScoringCriteria = z.infer<typeof scoringCriteriaSchema>;
export type ScoringWeights = z.infer<typeof scoringWeightsSchema>;
export type CreateScoringModelInput = z.infer<typeof createScoringModelSchema>;
export type UpdateScoringModelInput = z.infer<typeof updateScoringModelSchema>;
export type RescoreLeadInput = z.infer<typeof rescoreLeadSchema>;
export type BatchRescoreInput = z.infer<typeof batchRescoreSchema>;
