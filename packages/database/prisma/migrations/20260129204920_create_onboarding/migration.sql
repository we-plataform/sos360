-- CreateOnboarding
-- Create enum types for onboarding
CREATE TYPE "OnboardingPersona" AS ENUM ('sales', 'marketing', 'management');

CREATE TYPE "OnboardingStatus" AS ENUM ('not_started', 'in_progress', 'completed', 'skipped');

CREATE TYPE "OnboardingStepType" AS ENUM (
  'install_extension',
  'create_pipeline',
  'capture_lead',
  'send_message',
  'create_automation',
  'create_audience',
  'import_leads',
  'setup_workspace'
);

-- Create onboarding_progress table
CREATE TABLE "onboarding_progress" (
    "id" TEXT NOT NULL,
    "persona" "OnboardingPersona" NOT NULL DEFAULT 'sales',
    "status" "OnboardingStatus" NOT NULL DEFAULT 'not_started',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

-- Create onboarding_steps table
CREATE TABLE "onboarding_steps" (
    "id" TEXT NOT NULL,
    "stepType" "OnboardingStepType" NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "progressId" TEXT NOT NULL,

    CONSTRAINT "onboarding_steps_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_userId_key" UNIQUE ("userId");
ALTER TABLE "onboarding_steps" ADD CONSTRAINT "onboarding_steps_progressId_stepType_key" UNIQUE ("progressId", "stepType");

-- Create indexes for onboarding_progress
CREATE INDEX "onboarding_progress_userId_idx" ON "onboarding_progress"("userId");
CREATE INDEX "onboarding_progress_status_idx" ON "onboarding_progress"("status");

-- Create index for onboarding_steps
CREATE INDEX "onboarding_steps_progressId_idx" ON "onboarding_steps"("progressId");

-- Add foreign key constraint from onboarding_progress to users
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign key constraint from onboarding_steps to onboarding_progress
ALTER TABLE "onboarding_steps" ADD CONSTRAINT "onboarding_steps_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "onboarding_progress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
