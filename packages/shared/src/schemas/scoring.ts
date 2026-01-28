import { z } from "zod";

// ============================================
// SCORING CONFIGURATION SCHEMAS
// ============================================

// Helper for optional string
const optionalString = z
  .union([z.string(), z.literal(""), z.null(), z.undefined()])
  .transform((val) =>
    val === "" || val === null || val === undefined ? null : val,
  );

// Helper for optional int with min/max bounds
const optionalIntBounded = (min: number, max: number) =>
  z
    .union([z.number().int().min(min).max(max), z.null(), z.undefined()])
    .optional();

// Company size enum (matching Prisma)
export const companySizeSchema = z.enum([
  "SIZE_1_10",
  "SIZE_11_50",
  "SIZE_51_200",
  "SIZE_201_500",
  "SIZE_501_1000",
  "SIZE_1001_5000",
  "SIZE_5001_10000",
  "SIZE_10001_PLUS",
]);

// ============================================
// Scoring Configuration (Create/Update)
// ============================================

export const createScoringConfigSchema = z
  .object({
    // Scoring weights (0-100, should sum to 100)
    jobTitleWeight: z.number().int().min(0).max(100).default(25),
    companyWeight: z.number().int().min(0).max(100).default(20),
    profileCompletenessWeight: z.number().int().min(0).max(100).default(15),
    activityWeight: z.number().int().min(0).max(100).default(20),
    enrichmentWeight: z.number().int().min(0).max(100).default(20),

    // Target criteria (ICP - Ideal Customer Profile)
    targetJobTitles: z.array(z.string()).default([]),
    targetCompanySizes: z.array(companySizeSchema).default([]),
    targetIndustries: z.array(z.string()).default([]),
    minProfileCompleteness: z.number().int().min(0).max(100).default(50),

    // Additional settings
    autoScoreOnImport: z.boolean().default(true),
    autoScoreOnUpdate: z.boolean().default(true),
  })
  .refine(
    (data) => {
      const total =
        data.jobTitleWeight +
        data.companyWeight +
        data.profileCompletenessWeight +
        data.activityWeight +
        data.enrichmentWeight;
      return total === 100;
    },
    {
      message: "Scoring weights must sum to exactly 100",
      path: ["jobTitleWeight"],
    },
  );

export const updateScoringConfigSchema = z
  .object({
    // Scoring weights (0-100, should sum to 100)
    jobTitleWeight: optionalIntBounded(0, 100),
    companyWeight: optionalIntBounded(0, 100),
    profileCompletenessWeight: optionalIntBounded(0, 100),
    activityWeight: optionalIntBounded(0, 100),
    enrichmentWeight: optionalIntBounded(0, 100),

    // Target criteria (ICP - Ideal Customer Profile)
    targetJobTitles: z.array(z.string()).optional(),
    targetCompanySizes: z.array(companySizeSchema).optional(),
    targetIndustries: z.array(z.string()).optional(),
    minProfileCompleteness: optionalIntBounded(0, 100),

    // Additional settings
    autoScoreOnImport: z.boolean().optional(),
    autoScoreOnUpdate: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // Only validate if at least one weight is provided
      const weights = [
        data.jobTitleWeight,
        data.companyWeight,
        data.profileCompletenessWeight,
        data.activityWeight,
        data.enrichmentWeight,
      ];
      const definedWeights = weights.filter(
        (w) => w !== undefined && w !== null,
      );
      if (definedWeights.length === 0) return true; // No weights provided, skip validation
      if (definedWeights.length !== weights.length) return true; // Partial update, skip validation

      const total = weights.reduce((sum: number, w) => sum + (w || 0), 0);
      return total === 100;
    },
    {
      message: "If updating all weights, they must sum to exactly 100",
      path: ["jobTitleWeight"],
    },
  );

// ============================================
// Scoring Request/Response
// ============================================

export const calculateLeadScoreSchema = z.object({
  leadId: z.string().min(1, "Lead ID is required"),
  forceRecalculate: z.boolean().optional().default(false),
});

export const batchCalculateScoresSchema = z.object({
  leadIds: z
    .array(z.string().min(1))
    .min(1, "At least one lead ID is required")
    .max(100, "Maximum 100 leads per batch"),
  forceRecalculate: z.boolean().optional().default(false),
});

export const leadScoreBreakdownSchema = z.object({
  jobTitleScore: z.number().min(0).max(100),
  companyScore: z.number().min(0).max(100),
  profileCompletenessScore: z.number().min(0).max(100),
  activityScore: z.number().min(0).max(100),
  enrichmentScore: z.number().min(0).max(100),
  finalScore: z.number().min(0).max(100),
  explanation: optionalString.optional(),
});

export const leadScoreResponseSchema = z.object({
  leadId: z.string(),
  score: z.number().min(0).max(100),
  breakdown: leadScoreBreakdownSchema.optional(),
  scoredAt: z.string().datetime().optional(),
});

export const batchScoreResponseSchema = z.object({
  results: z.array(leadScoreResponseSchema),
  totalProcessed: z.number().int().min(0),
  totalFailed: z.number().int().min(0),
  errors: z
    .array(
      z.object({
        leadId: z.string(),
        error: z.string(),
      }),
    )
    .optional(),
});

// ============================================
// Type Exports
// ============================================

export type CompanySize = z.infer<typeof companySizeSchema>;
export type CreateScoringConfig = z.infer<typeof createScoringConfigSchema>;
export type UpdateScoringConfig = z.infer<typeof updateScoringConfigSchema>;
export type CalculateLeadScore = z.infer<typeof calculateLeadScoreSchema>;
export type BatchCalculateScores = z.infer<typeof batchCalculateScoresSchema>;
export type LeadScoreBreakdown = z.infer<typeof leadScoreBreakdownSchema>;
export type LeadScoreResponse = z.infer<typeof leadScoreResponseSchema>;
export type BatchScoreResponse = z.infer<typeof batchScoreResponseSchema>;
