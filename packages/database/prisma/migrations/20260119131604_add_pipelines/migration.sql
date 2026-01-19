-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "pipelineStageId" TEXT,
ADD COLUMN     "position" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366F1',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pipelineId" TEXT NOT NULL,

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipelines_workspaceId_idx" ON "pipelines"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "pipelines_workspaceId_name_key" ON "pipelines"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "pipeline_stages_pipelineId_order_idx" ON "pipeline_stages"("pipelineId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stages_pipelineId_name_key" ON "pipeline_stages"("pipelineId", "name");

-- CreateIndex
CREATE INDEX "leads_pipelineStageId_position_idx" ON "leads"("pipelineStageId", "position");

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_pipelineStageId_fkey" FOREIGN KEY ("pipelineStageId") REFERENCES "pipeline_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
