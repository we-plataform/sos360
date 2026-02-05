-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('SOCIAL_SELLER', 'SDR', 'CLOSER');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('draft', 'active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('trigger_lead_stage_entry', 'trigger_lead_score_change', 'trigger_lead_field_change', 'trigger_time_based', 'trigger_webhook', 'trigger_manual', 'action_send_message', 'action_add_tag', 'action_remove_tag', 'action_assign_user', 'action_change_stage', 'action_update_lead_field', 'action_enqueue_agent', 'action_send_webhook', 'action_add_to_audience', 'action_remove_from_audience', 'action_wait_until_time', 'action_increment_score', 'action_decrement_score', 'condition', 'delay', 'loop', 'end');

-- CreateEnum
CREATE TYPE "WorkflowTestRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "EnrichmentStatus" AS ENUM ('none', 'partial', 'complete', 'failed');

-- CreateEnum
CREATE TYPE "LeadGender" AS ENUM ('male', 'female', 'other', 'unknown');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('SIZE_1_10', 'SIZE_11_50', 'SIZE_51_200', 'SIZE_201_500', 'SIZE_501_1000', 'SIZE_1001_5000', 'SIZE_5001_10000', 'SIZE_10001_PLUS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AutomationLogStatus" ADD VALUE 'pending';
ALTER TYPE "AutomationLogStatus" ADD VALUE 'running';

-- DropIndex
DROP INDEX "automation_logs_automationId_executedAt_idx";

-- AlterTable
ALTER TABLE "automation_logs" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "result" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "triggerType" TEXT NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "automations" ADD COLUMN     "pipelineStageId" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "companySize" "CompanySize",
ADD COLUMN     "enrichedAt" TIMESTAMP(3),
ADD COLUMN     "enrichmentStatus" "EnrichmentStatus" NOT NULL DEFAULT 'none',
ADD COLUMN     "gender" "LeadGender",
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "priority" "LeadPriority";

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "thumbnail" TEXT,
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "edges" JSONB NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "stats" JSONB NOT NULL DEFAULT '{"uses": 0}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT,
    "createdById" TEXT,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AgentType" NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 500,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'draft',
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "stats" JSONB NOT NULL DEFAULT '{"runs": 0, "success": 0, "failed": 0}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_nodes" (
    "id" TEXT NOT NULL,
    "type" "NodeType" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "position" JSONB NOT NULL DEFAULT '{"x": 0, "y": 0}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workflowId" TEXT NOT NULL,

    CONSTRAINT "workflow_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_edges" (
    "id" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workflowId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,

    CONSTRAINT "workflow_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_test_runs" (
    "id" TEXT NOT NULL,
    "status" "WorkflowTestRunStatus" NOT NULL DEFAULT 'pending',
    "result" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "workflowId" TEXT NOT NULL,
    "testLeadId" TEXT,

    CONSTRAINT "workflow_test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_behaviors" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "maritalStatus" TEXT,
    "hasChildren" BOOLEAN,
    "deviceType" TEXT,
    "interests" TEXT[],
    "personalityType" TEXT,
    "buyingIntent" TEXT,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "rawAnalysis" JSONB NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_behaviors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_addresses" (
    "id" TEXT NOT NULL,
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "leadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audiences" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ignoreGenderIfUnknown" BOOLEAN NOT NULL DEFAULT true,
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ignoreCountryIfUnknown" BOOLEAN NOT NULL DEFAULT true,
    "excludePrivate" BOOLEAN NOT NULL DEFAULT false,
    "excludeNoMessage" BOOLEAN NOT NULL DEFAULT false,
    "excludeNoPhoto" BOOLEAN NOT NULL DEFAULT false,
    "excludeCompanyPages" BOOLEAN NOT NULL DEFAULT false,
    "verifiedFilter" TEXT NOT NULL DEFAULT 'any',
    "friendsMin" INTEGER,
    "friendsMax" INTEGER,
    "mutualFriendsMin" INTEGER,
    "mutualFriendsMax" INTEGER,
    "followersMin" INTEGER,
    "followersMax" INTEGER,
    "postsMin" INTEGER,
    "postsMax" INTEGER,
    "jobTitleInclude" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "jobTitleExclude" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "profileInfoInclude" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "profileInfoExclude" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "postContentInclude" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "postContentExclude" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "audiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_configs" (
    "id" TEXT NOT NULL,
    "jobTitleWeight" INTEGER NOT NULL DEFAULT 25,
    "companyWeight" INTEGER NOT NULL DEFAULT 20,
    "profileCompletenessWeight" INTEGER NOT NULL DEFAULT 15,
    "activityWeight" INTEGER NOT NULL DEFAULT 20,
    "enrichmentWeight" INTEGER NOT NULL DEFAULT 20,
    "targetJobTitles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetCompanySizes" "CompanySize"[] DEFAULT ARRAY[]::"CompanySize"[],
    "targetIndustries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minProfileCompleteness" INTEGER NOT NULL DEFAULT 50,
    "autoScoreOnImport" BOOLEAN NOT NULL DEFAULT true,
    "autoScoreOnUpdate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "scoring_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_experiences" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyUrl" TEXT,
    "companyLogo" TEXT,
    "roleTitle" TEXT NOT NULL,
    "employmentType" TEXT,
    "location" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "duration" TEXT,
    "description" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_educations" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "school" TEXT NOT NULL,
    "schoolUrl" TEXT,
    "schoolLogo" TEXT,
    "degree" TEXT,
    "fieldOfStudy" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "grade" TEXT,
    "activities" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_educations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_certifications" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "issuerUrl" TEXT,
    "issuerLogo" TEXT,
    "issueDate" TEXT,
    "expirationDate" TEXT,
    "credentialId" TEXT,
    "credentialUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_skills" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "endorsementsCount" INTEGER,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_languages" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "proficiency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_recommendations" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorUrl" TEXT,
    "authorHeadline" TEXT,
    "authorAvatar" TEXT,
    "relationship" TEXT,
    "date" TEXT,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_volunteers" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "role" TEXT,
    "cause" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_volunteers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_publications" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT,
    "date" TEXT,
    "url" TEXT,
    "description" TEXT,
    "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_patents" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "patentNumber" TEXT,
    "status" TEXT,
    "date" TEXT,
    "url" TEXT,
    "description" TEXT,
    "inventors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_patents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_projects" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "description" TEXT,
    "collaborators" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_courses" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "courseNumber" TEXT,
    "associatedWith" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_honors" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT,
    "date" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_honors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_organizations" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_featured" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "thumbnailUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_featured_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_contact_info" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "twitter" TEXT,
    "birthday" TEXT,
    "address" TEXT,
    "profileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_contact_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_posts" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "content" TEXT,
    "date" TEXT,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedUrl" TEXT,
    "postUrl" TEXT,
    "postType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "postUrl" TEXT NOT NULL,
    "content" TEXT,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedUrl" TEXT,
    "postType" TEXT,
    "likesCount" INTEGER,
    "commentsCount" INTEGER,
    "sharesCount" INTEGER,
    "viewsCount" INTEGER,
    "authorUsername" TEXT NOT NULL,
    "authorFullName" TEXT,
    "authorAvatarUrl" TEXT,
    "authorProfileUrl" TEXT,
    "leadId" TEXT,
    "postDate" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_tags" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_tags_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateIndex
CREATE INDEX "workflow_templates_workspaceId_idx" ON "workflow_templates"("workspaceId");

-- CreateIndex
CREATE INDEX "workflow_templates_isSystem_idx" ON "workflow_templates"("isSystem");

-- CreateIndex
CREATE INDEX "agents_workspaceId_enabled_idx" ON "agents"("workspaceId", "enabled");

-- CreateIndex
CREATE INDEX "agents_workspaceId_type_idx" ON "agents"("workspaceId", "type");

-- CreateIndex
CREATE INDEX "workflows_workspaceId_status_idx" ON "workflows"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "workflows_workspaceId_isTemplate_idx" ON "workflows"("workspaceId", "isTemplate");

-- CreateIndex
CREATE INDEX "workflow_nodes_workflowId_idx" ON "workflow_nodes"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_nodes_workflowId_type_idx" ON "workflow_nodes"("workflowId", "type");

-- CreateIndex
CREATE INDEX "workflow_edges_workflowId_idx" ON "workflow_edges"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_edges_sourceNodeId_idx" ON "workflow_edges"("sourceNodeId");

-- CreateIndex
CREATE INDEX "workflow_edges_targetNodeId_idx" ON "workflow_edges"("targetNodeId");

-- CreateIndex
CREATE INDEX "workflow_test_runs_workflowId_startedAt_idx" ON "workflow_test_runs"("workflowId", "startedAt");

-- CreateIndex
CREATE INDEX "workflow_test_runs_testLeadId_idx" ON "workflow_test_runs"("testLeadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_behaviors_leadId_key" ON "lead_behaviors"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_addresses_leadId_key" ON "lead_addresses"("leadId");

-- CreateIndex
CREATE INDEX "lead_addresses_leadId_idx" ON "lead_addresses"("leadId");

-- CreateIndex
CREATE INDEX "audiences_workspaceId_idx" ON "audiences"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "audiences_workspaceId_name_key" ON "audiences"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_configs_workspaceId_key" ON "scoring_configs"("workspaceId");

-- CreateIndex
CREATE INDEX "scoring_configs_workspaceId_idx" ON "scoring_configs"("workspaceId");

-- CreateIndex
CREATE INDEX "lead_experiences_leadId_idx" ON "lead_experiences"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_experiences_leadId_companyName_roleTitle_startDate_key" ON "lead_experiences"("leadId", "companyName", "roleTitle", "startDate");

-- CreateIndex
CREATE INDEX "lead_educations_leadId_idx" ON "lead_educations"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_educations_leadId_school_degree_startDate_key" ON "lead_educations"("leadId", "school", "degree", "startDate");

-- CreateIndex
CREATE INDEX "lead_certifications_leadId_idx" ON "lead_certifications"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_certifications_leadId_name_issuer_key" ON "lead_certifications"("leadId", "name", "issuer");

-- CreateIndex
CREATE INDEX "lead_skills_leadId_idx" ON "lead_skills"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_skills_leadId_name_key" ON "lead_skills"("leadId", "name");

-- CreateIndex
CREATE INDEX "lead_languages_leadId_idx" ON "lead_languages"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_languages_leadId_name_key" ON "lead_languages"("leadId", "name");

-- CreateIndex
CREATE INDEX "lead_recommendations_leadId_idx" ON "lead_recommendations"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_recommendations_leadId_authorName_date_key" ON "lead_recommendations"("leadId", "authorName", "date");

-- CreateIndex
CREATE INDEX "lead_volunteers_leadId_idx" ON "lead_volunteers"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_volunteers_leadId_organization_role_key" ON "lead_volunteers"("leadId", "organization", "role");

-- CreateIndex
CREATE INDEX "lead_publications_leadId_idx" ON "lead_publications"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_publications_leadId_title_publisher_key" ON "lead_publications"("leadId", "title", "publisher");

-- CreateIndex
CREATE INDEX "lead_patents_leadId_idx" ON "lead_patents"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_patents_leadId_title_patentNumber_key" ON "lead_patents"("leadId", "title", "patentNumber");

-- CreateIndex
CREATE INDEX "lead_projects_leadId_idx" ON "lead_projects"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_projects_leadId_title_key" ON "lead_projects"("leadId", "title");

-- CreateIndex
CREATE INDEX "lead_courses_leadId_idx" ON "lead_courses"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_courses_leadId_name_key" ON "lead_courses"("leadId", "name");

-- CreateIndex
CREATE INDEX "lead_honors_leadId_idx" ON "lead_honors"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_honors_leadId_title_issuer_key" ON "lead_honors"("leadId", "title", "issuer");

-- CreateIndex
CREATE INDEX "lead_organizations_leadId_idx" ON "lead_organizations"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_organizations_leadId_name_position_key" ON "lead_organizations"("leadId", "name", "position");

-- CreateIndex
CREATE INDEX "lead_featured_leadId_idx" ON "lead_featured"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_contact_info_leadId_key" ON "lead_contact_info"("leadId");

-- CreateIndex
CREATE INDEX "lead_posts_leadId_idx" ON "lead_posts"("leadId");

-- CreateIndex
CREATE INDEX "posts_workspaceId_platform_idx" ON "posts"("workspaceId", "platform");

-- CreateIndex
CREATE INDEX "posts_workspaceId_authorUsername_idx" ON "posts"("workspaceId", "authorUsername");

-- CreateIndex
CREATE INDEX "posts_workspaceId_importedAt_idx" ON "posts"("workspaceId", "importedAt");

-- CreateIndex
CREATE INDEX "posts_leadId_idx" ON "posts"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "posts_workspaceId_platform_postUrl_key" ON "posts"("workspaceId", "platform", "postUrl");

-- CreateIndex
CREATE INDEX "automation_logs_automationId_startedAt_idx" ON "automation_logs"("automationId", "startedAt");

-- CreateIndex
CREATE INDEX "automations_pipelineStageId_idx" ON "automations"("pipelineStageId");

-- CreateIndex
CREATE INDEX "leads_enrichmentStatus_idx" ON "leads"("enrichmentStatus");

-- AddForeignKey
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_pipelineStageId_fkey" FOREIGN KEY ("pipelineStageId") REFERENCES "pipeline_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_nodes" ADD CONSTRAINT "workflow_nodes_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_test_runs" ADD CONSTRAINT "workflow_test_runs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_test_runs" ADD CONSTRAINT "workflow_test_runs_testLeadId_fkey" FOREIGN KEY ("testLeadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_behaviors" ADD CONSTRAINT "lead_behaviors_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_addresses" ADD CONSTRAINT "lead_addresses_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audiences" ADD CONSTRAINT "audiences_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_configs" ADD CONSTRAINT "scoring_configs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_experiences" ADD CONSTRAINT "lead_experiences_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_educations" ADD CONSTRAINT "lead_educations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_certifications" ADD CONSTRAINT "lead_certifications_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_skills" ADD CONSTRAINT "lead_skills_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_languages" ADD CONSTRAINT "lead_languages_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_recommendations" ADD CONSTRAINT "lead_recommendations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_volunteers" ADD CONSTRAINT "lead_volunteers_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_publications" ADD CONSTRAINT "lead_publications_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_patents" ADD CONSTRAINT "lead_patents_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_projects" ADD CONSTRAINT "lead_projects_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_courses" ADD CONSTRAINT "lead_courses_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_honors" ADD CONSTRAINT "lead_honors_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_organizations" ADD CONSTRAINT "lead_organizations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_featured" ADD CONSTRAINT "lead_featured_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_contact_info" ADD CONSTRAINT "lead_contact_info_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_posts" ADD CONSTRAINT "lead_posts_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

