-- AlterTable
ALTER TABLE "leads" ALTER COLUMN "platform" DROP NOT NULL;

-- CreateTable
CREATE TABLE "social_profiles" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "username" TEXT,
    "profileUrl" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "followersCount" INTEGER,
    "followingCount" INTEGER,
    "postsCount" INTEGER,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leadId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "social_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_profiles_leadId_idx" ON "social_profiles"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "social_profiles_workspaceId_platform_profileUrl_key" ON "social_profiles"("workspaceId", "platform", "profileUrl");

-- AddForeignKey
ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
