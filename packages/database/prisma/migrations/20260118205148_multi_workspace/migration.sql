/*
  Warnings:

  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `workspaceId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `workspaces` table. All the data in the column will be lost.
  - You are about to drop the `invitations` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `companyId` to the `workspaces` table without a default value. This is not possible if the table is not empty.

*/

-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('owner', 'admin', 'member');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('owner', 'admin', 'manager', 'agent', 'viewer');

-- CreateTable Companies (Created early to populate)
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'trial',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "billingInfo" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable CompanyMembers
CREATE TABLE "company_members" (
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "CompanyRole" NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_members_pkey" PRIMARY KEY ("userId","companyId")
);

-- CreateTable WorkspaceMembers
CREATE TABLE "workspace_members" (
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'agent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("userId","workspaceId")
);

-- CreateTable CompanyInvitations
CREATE TABLE "company_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "CompanyRole" NOT NULL DEFAULT 'member',
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,
    "workspaceAccess" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "company_invitations_pkey" PRIMARY KEY ("id")
);

-- DATA MIGRATION START

-- 1. Create companies from workspaces
INSERT INTO "companies" ("id", "name", "slug", "plan", "settings", "billingInfo", "createdAt", "updatedAt")
SELECT
  'company_' || "id",
  "name",
  -- Simple slug generation: lowercase, replace spaces with dashes, remove dots. 
  -- Appending random string to ensure uniqueness if duplicate names exist
  LOWER(REPLACE(REPLACE("name", ' ', '-'), '.', '')) || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6),
  "plan",
  "settings",
  '{}',
  "createdAt",
  "updatedAt"
FROM "workspaces";

-- 2. Migrate Users to CompanyMembers and WorkspaceMembers
-- Assuming User.role maps effectively.
-- Note: users table still has role and workspaceId at this point.
INSERT INTO "company_members" ("userId", "companyId", "role", "createdAt")
SELECT
  u."id",
  'company_' || u."workspaceId",
  CASE
    WHEN u."role"::text = 'owner' THEN 'owner'::"CompanyRole"
    WHEN u."role"::text = 'admin' THEN 'admin'::"CompanyRole"
    ELSE 'member'::"CompanyRole"
  END,
  u."createdAt"
FROM "users" u
WHERE u."workspaceId" IS NOT NULL;

INSERT INTO "workspace_members" ("userId", "workspaceId", "role", "createdAt")
SELECT
  u."id",
  u."workspaceId",
  -- Map old role to new WorkspaceRole. They are mostly same but valid casting needed.
  u."role"::text::"WorkspaceRole",
  u."createdAt"
FROM "users" u
WHERE u."workspaceId" IS NOT NULL;

-- 3. Migrate Invitations
-- Note: Invitations table exists.
INSERT INTO "company_invitations" ("id", "email", "role", "token", "status", "expiresAt", "createdAt", "companyId", "workspaceAccess")
SELECT
  i."id",
  i."email",
  'member'::"CompanyRole",
  i."token",
  i."status",
  i."expiresAt",
  i."createdAt",
  'company_' || i."workspaceId",
  json_build_array(json_build_object('workspaceId', i."workspaceId", 'role', i."role"))
FROM "invitations" i;

-- DATA MIGRATION END

-- Now Modify Tables (Drop old columns, add new ones properly)

-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_workspaceId_fkey";

-- DropIndex
DROP INDEX "leads_customFields_gin_idx";
DROP INDEX "leads_email_trgm_idx";
DROP INDEX "leads_fullName_trgm_idx";
DROP INDEX "users_fullName_trgm_idx";
DROP INDEX "users_settings_gin_idx";
DROP INDEX "users_workspaceId_idx";
DROP INDEX "workspaces_settings_gin_idx";

-- AlterTable Users
ALTER TABLE "users" DROP COLUMN "role",
DROP COLUMN "workspaceId";

-- AlterTable Workspaces
-- Add companyId as Nullable first
ALTER TABLE "workspaces" ADD COLUMN "companyId" TEXT;

-- Update companyId
UPDATE "workspaces"
SET "companyId" = 'company_' || "id";

-- Make companyId Not Null
ALTER TABLE "workspaces" ALTER COLUMN "companyId" SET NOT NULL;

-- Drop Plan from Workspaces
ALTER TABLE "workspaces" DROP COLUMN "plan";

-- DropTable Invitations
DROP TABLE "invitations";

-- DropEnum Role
DROP TYPE "Role";

-- Create Indexes
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");
CREATE INDEX "company_members_companyId_idx" ON "company_members"("companyId");
CREATE UNIQUE INDEX "company_invitations_token_key" ON "company_invitations"("token");
CREATE INDEX "company_invitations_token_idx" ON "company_invitations"("token");
CREATE UNIQUE INDEX "company_invitations_companyId_email_key" ON "company_invitations"("companyId", "email");
CREATE INDEX "workspace_members_workspaceId_idx" ON "workspace_members"("workspaceId");
CREATE INDEX "workspaces_companyId_idx" ON "workspaces"("companyId");

-- Add Foreign Keys
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_members" ADD CONSTRAINT "company_members_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
