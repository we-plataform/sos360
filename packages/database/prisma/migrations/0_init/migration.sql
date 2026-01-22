-- ============================================
-- SOS 360 - Database Schema
-- Execute este SQL no Neon Console ou via Prisma
-- ============================================

-- Habilitar extensão para busca full-text (opcional, mas recomendado)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE "Plan" AS ENUM ('trial', 'starter', 'professional', 'business', 'enterprise');
CREATE TYPE "Role" AS ENUM ('owner', 'admin', 'manager', 'agent', 'viewer');
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'expired');
CREATE TYPE "Platform" AS ENUM (
  'instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 
  'whatsapp', 'telegram', 'discord', 'reddit', 'skool', 
  'slack', 'pinterest', 'youtube', 'nextdoor', 'gohighlevel', 'other'
);
CREATE TYPE "LeadStatus" AS ENUM ('new', 'contacted', 'responded', 'qualified', 'scheduled', 'closed', 'lost');
CREATE TYPE "ConversationStatus" AS ENUM ('active', 'archived');
CREATE TYPE "SenderType" AS ENUM ('agent', 'lead', 'system');
CREATE TYPE "MessageType" AS ENUM ('text', 'image', 'video', 'audio', 'document', 'template');
CREATE TYPE "MessageStatus" AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');
CREATE TYPE "AutomationLogStatus" AS ENUM ('success', 'failed', 'skipped');
CREATE TYPE "ActivityType" AS ENUM (
  'lead_created', 'lead_updated', 'lead_imported', 'status_changed',
  'tag_added', 'tag_removed', 'assigned', 'message_sent',
  'message_received', 'score_updated', 'automation_triggered', 'note_added'
);
CREATE TYPE "ImportJobStatus" AS ENUM ('queued', 'processing', 'completed', 'failed');

-- ============================================
-- TABELAS
-- ============================================

-- Workspaces
CREATE TABLE "workspaces" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "plan" "Plan" NOT NULL DEFAULT 'trial',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Users
CREATE TABLE "users" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "role" "Role" NOT NULL DEFAULT 'agent',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "workspaceId" TEXT NOT NULL,
  CONSTRAINT "users_workspaceId_fkey" FOREIGN KEY ("workspaceId") 
    REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Invitations
CREATE TABLE "invitations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'agent',
  "token" TEXT NOT NULL UNIQUE,
  "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "workspaceId" TEXT NOT NULL,
  CONSTRAINT "invitations_workspaceId_fkey" FOREIGN KEY ("workspaceId") 
    REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "invitations_workspaceId_email_key" UNIQUE ("workspaceId", "email")
);

-- Refresh Tokens
CREATE TABLE "refresh_tokens" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "token" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tags
CREATE TABLE "tags" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#6366F1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "workspaceId" TEXT NOT NULL,
  CONSTRAINT "tags_workspaceId_fkey" FOREIGN KEY ("workspaceId") 
    REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tags_workspaceId_name_key" UNIQUE ("workspaceId", "name")
);

-- Leads
CREATE TABLE "leads" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "platform" "Platform" NOT NULL,
  "username" TEXT,
  "fullName" TEXT,
  "profileUrl" TEXT,
  "avatarUrl" TEXT,
  "bio" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "website" TEXT,
  "location" TEXT,
  "followersCount" INTEGER,
  "followingCount" INTEGER,
  "postsCount" INTEGER,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "score" INTEGER NOT NULL DEFAULT 0,
  "status" "LeadStatus" NOT NULL DEFAULT 'new',
  "notes" TEXT,
  "sourceUrl" TEXT,
  "customFields" JSONB NOT NULL DEFAULT '{}',
  "lastInteractionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "assignedToId" TEXT,
  CONSTRAINT "leads_workspaceId_fkey" FOREIGN KEY ("workspaceId") 
    REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") 
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "leads_workspaceId_platform_profileUrl_key" UNIQUE ("workspaceId", "platform", "profileUrl")
);

-- Lead Tags (Many-to-Many)
CREATE TABLE "lead_tags" (
  "leadId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_tags_leadId_fkey" FOREIGN KEY ("leadId") 
    REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lead_tags_tagId_fkey" FOREIGN KEY ("tagId") 
    REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("leadId", "tagId")
);

-- Conversations
CREATE TABLE "conversations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "platform" "Platform" NOT NULL,
  "status" "ConversationStatus" NOT NULL DEFAULT 'active',
  "unreadCount" INTEGER NOT NULL DEFAULT 0,
  "lastMessageAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "leadId" TEXT NOT NULL UNIQUE,
  "assignedToId" TEXT,
  CONSTRAINT "conversations_leadId_fkey" FOREIGN KEY ("leadId") 
    REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "conversations_assignedToId_fkey" FOREIGN KEY ("assignedToId") 
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Messages
CREATE TABLE "messages" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "content" TEXT NOT NULL,
  "senderType" "SenderType" NOT NULL,
  "messageType" "MessageType" NOT NULL DEFAULT 'text',
  "status" "MessageStatus" NOT NULL DEFAULT 'pending',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "readAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT,
  CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") 
    REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") 
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Templates
CREATE TABLE "templates" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "platform" "Platform",
  "category" TEXT,
  "variables" JSONB NOT NULL DEFAULT '[]',
  "stats" JSONB NOT NULL DEFAULT '{"sent": 0, "responseRate": 0}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") 
    REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "templates_createdById_fkey" FOREIGN KEY ("createdById") 
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Automations
CREATE TABLE "automations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "triggerType" TEXT NOT NULL,
  "triggerConfig" JSONB NOT NULL,
  "actions" JSONB NOT NULL,
  "conditions" JSONB NOT NULL DEFAULT '[]',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "stats" JSONB NOT NULL DEFAULT '{"runs": 0, "success": 0, "failed": 0}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "automations_workspaceId_fkey" FOREIGN KEY ("workspaceId") 
    REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "automations_createdById_fkey" FOREIGN KEY ("createdById") 
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Automation Logs
CREATE TABLE "automation_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "status" "AutomationLogStatus" NOT NULL,
  "actionsExecuted" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "automationId" TEXT NOT NULL,
  "leadId" TEXT,
  CONSTRAINT "automation_logs_automationId_fkey" FOREIGN KEY ("automationId") 
    REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "automation_logs_leadId_fkey" FOREIGN KEY ("leadId") 
    REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Activities (Audit Trail)
CREATE TABLE "activities" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" "ActivityType" NOT NULL,
  "description" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leadId" TEXT,
  "userId" TEXT,
  CONSTRAINT "activities_leadId_fkey" FOREIGN KEY ("leadId") 
    REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") 
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Webhooks
CREATE TABLE "webhooks" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "url" TEXT NOT NULL,
  "events" TEXT[] NOT NULL,
  "secret" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastTriggeredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "workspaceId" TEXT NOT NULL,
  CONSTRAINT "webhooks_workspaceId_fkey" FOREIGN KEY ("workspaceId") 
    REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Import Jobs
CREATE TABLE "import_jobs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "platform" "Platform" NOT NULL,
  "sourceUrl" TEXT,
  "status" "ImportJobStatus" NOT NULL DEFAULT 'queued',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "totalLeads" INTEGER NOT NULL DEFAULT 0,
  "result" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "workspaceId" TEXT NOT NULL,
  CONSTRAINT "import_jobs_workspaceId_fkey" FOREIGN KEY ("workspaceId") 
    REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================
-- ÍNDICES
-- ============================================

-- Users
CREATE INDEX "users_workspaceId_idx" ON "users"("workspaceId");
CREATE INDEX "users_email_idx" ON "users"("email");

-- Invitations
CREATE INDEX "invitations_token_idx" ON "invitations"("token");

-- Refresh Tokens
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- Leads
CREATE INDEX "leads_workspaceId_status_idx" ON "leads"("workspaceId", "status");
CREATE INDEX "leads_workspaceId_platform_idx" ON "leads"("workspaceId", "platform");
CREATE INDEX "leads_workspaceId_score_idx" ON "leads"("workspaceId", "score");
CREATE INDEX "leads_workspaceId_createdAt_idx" ON "leads"("workspaceId", "createdAt");
CREATE INDEX "leads_assignedToId_idx" ON "leads"("assignedToId");

-- Conversations
CREATE INDEX "conversations_leadId_idx" ON "conversations"("leadId");
CREATE INDEX "conversations_assignedToId_idx" ON "conversations"("assignedToId");
CREATE INDEX "conversations_status_lastMessageAt_idx" ON "conversations"("status", "lastMessageAt");

-- Messages
CREATE INDEX "messages_conversationId_sentAt_idx" ON "messages"("conversationId", "sentAt");

-- Templates
CREATE INDEX "templates_workspaceId_idx" ON "templates"("workspaceId");

-- Automations
CREATE INDEX "automations_workspaceId_enabled_idx" ON "automations"("workspaceId", "enabled");

-- Automation Logs
CREATE INDEX "automation_logs_automationId_executedAt_idx" ON "automation_logs"("automationId", "executedAt");

-- Activities
CREATE INDEX "activities_leadId_createdAt_idx" ON "activities"("leadId", "createdAt");
CREATE INDEX "activities_userId_createdAt_idx" ON "activities"("userId", "createdAt");

-- Webhooks
CREATE INDEX "webhooks_workspaceId_idx" ON "webhooks"("workspaceId");

-- Import Jobs
CREATE INDEX "import_jobs_workspaceId_createdAt_idx" ON "import_jobs"("workspaceId", "createdAt");

-- ============================================
-- TRIGGERS PARA updatedAt
-- ============================================

-- Função para atualizar updatedAt automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para tabelas com updatedAt
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON "workspaces"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON "leads"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON "conversations"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON "templates"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automations_updated_at BEFORE UPDATE ON "automations"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON "webhooks"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ÍNDICES PARA BUSCA FULL-TEXT (opcional)
-- ============================================

-- Índice GIN para busca em JSONB (customFields, settings, etc)
CREATE INDEX IF NOT EXISTS "leads_customFields_gin_idx" ON "leads" USING GIN ("customFields");
CREATE INDEX IF NOT EXISTS "users_settings_gin_idx" ON "users" USING GIN ("settings");
CREATE INDEX IF NOT EXISTS "workspaces_settings_gin_idx" ON "workspaces" USING GIN ("settings");

-- Índice para busca de texto (usando pg_trgm)
CREATE INDEX IF NOT EXISTS "leads_fullName_trgm_idx" ON "leads" USING GIN ("fullName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "leads_email_trgm_idx" ON "leads" USING GIN ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_fullName_trgm_idx" ON "users" USING GIN ("fullName" gin_trgm_ops);

-- ============================================
-- FIM DO SCRIPT
-- ============================================
