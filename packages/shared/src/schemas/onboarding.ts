import { z } from 'zod';

// Onboarding persona enum
export const onboardingPersonaSchema = z.enum(['sales', 'marketing', 'management']);

// Onboarding status enum
export const onboardingStatusSchema = z.enum(['not_started', 'in_progress', 'completed', 'skipped']);

// Onboarding step type enum
export const onboardingStepTypeSchema = z.enum([
  'install_extension',
  'create_pipeline',
  'capture_lead',
  'send_message',
  'create_automation',
  'create_audience',
  'import_leads',
  'setup_workspace',
]);

// Create or update onboarding progress schema
export const updateOnboardingProgressSchema = z.object({
  persona: onboardingPersonaSchema.optional(),
  status: onboardingStatusSchema.optional(),
});

// Update onboarding step schema
export const updateOnboardingStepSchema = z.object({
  stepType: onboardingStepTypeSchema,
  isCompleted: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
});

// Complete onboarding schema
export const completeOnboardingSchema = z.object({
  // No body required for completing onboarding - just sets status to completed
});
