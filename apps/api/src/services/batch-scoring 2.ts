import { prisma } from "@lia360/database";
import { scoringService } from "./scoring.js";
import { logger } from "../lib/logger.js";

/**
 * Batch Scoring Scheduler
 * Handles scheduled re-scoring of leads
 */
class BatchScoringScheduler {
  private isRunning = false;
  private intervalMs = 24 * 60 * 60 * 1000; // Default: daily

  /**
   * Start the batch scoring scheduler
   */
  start(intervalMs?: number): void {
    if (this.isRunning) {
      logger.warn("Batch scoring scheduler already running");
      return;
    }

    if (intervalMs) {
      this.intervalMs = intervalMs;
    }

    this.isRunning = true;
    logger.info(
      `Batch scoring scheduler started (interval: ${this.intervalMs}ms)`,
    );

    // Run immediately on start
    this.runBatchJob().catch((err) => {
      logger.error({ err }, "Initial batch scoring job failed");
    });

    // Schedule recurring runs
    setInterval(() => {
      this.runBatchJob().catch((err) => {
        logger.error({ err }, "Scheduled batch scoring job failed");
      });
    }, this.intervalMs);
  }

  /**
   * Stop the batch scoring scheduler
   */
  stop(): void {
    this.isRunning = false;
    logger.info("Batch scoring scheduler stopped");
  }

  /**
   * Run the batch scoring job
   * Scores all leads that have enabled scoring models
   */
  private async runBatchJob(): Promise<void> {
    try {
      logger.info("Starting batch scoring job");

      // Check if ScoringModel exists in schema (it may not exist yet)
      if (!prisma.scoringModel) {
        logger.warn(
          "ScoringModel not found in schema - batch scoring disabled. Use ScoringConfig for workspace-level scoring instead.",
        );
        return;
      }

      // Get all pipelines with enabled scoring models
      const scoringModels = await prisma.scoringModel.findMany({
        where: { enabled: true },
        include: {
          pipeline: {
            include: {
              stages: {
                include: {
                  leads: {
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      });

      let totalLeads = 0;
      let totalScored = 0;
      let totalFailed = 0;

      for (const model of scoringModels) {
        // Collect all lead IDs from this pipeline
        const leadIds = model.pipeline.stages.flatMap((stage) =>
          stage.leads.map((lead) => lead.id),
        );

        totalLeads += leadIds.length;

        if (leadIds.length === 0) {
          logger.info(
            { pipelineId: model.pipelineId, modelName: model.name },
            "No leads to score for pipeline",
          );
          continue;
        }

        logger.info(
          {
            pipelineId: model.pipelineId,
            modelName: model.name,
            leadCount: leadIds.length,
          },
          "Scoring leads for pipeline",
        );

        // Score leads in batches
        const batchSize = 50;
        for (let i = 0; i < leadIds.length; i += batchSize) {
          const batch = leadIds.slice(i, i + batchSize);
          const result = await scoringService.batchScoreLeads(
            batch,
            "batch_job",
          );

          totalScored += result.succeeded;
          totalFailed += result.failed;

          logger.info(
            {
              pipelineId: model.pipelineId,
              batch: Math.floor(i / batchSize) + 1,
              totalBatches: Math.ceil(leadIds.length / batchSize),
              succeeded: result.succeeded,
              failed: result.failed,
            },
            "Batch completed",
          );
        }
      }

      logger.info(
        {
          totalLeads,
          totalScored,
          totalFailed,
          pipelinesProcessed: scoringModels.length,
        },
        "Batch scoring job completed",
      );
    } catch (error) {
      logger.error({ error }, "Batch scoring job failed");
      throw error;
    }
  }

  /**
   * Manually trigger a batch job for a specific pipeline
   */
  async scorePipeline(pipelineId: string): Promise<{
    succeeded: number;
    failed: number;
    errors: string[];
  }> {
    try {
      // Get all leads for the pipeline
      const pipeline = await prisma.pipeline.findUnique({
        where: { id: pipelineId },
        include: {
          stages: {
            include: {
              leads: {
                select: { id: true },
              },
            },
          },
        },
      });

      if (!pipeline) {
        throw new Error("Pipeline not found");
      }

      const leadIds = pipeline.stages.flatMap((stage) =>
        stage.leads.map((lead) => lead.id),
      );

      if (leadIds.length === 0) {
        return { succeeded: 0, failed: 0, errors: [] };
      }

      const result = await scoringService.batchScoreLeads(
        leadIds,
        "manual_batch",
      );

      return {
        succeeded: result.succeeded,
        failed: result.failed,
        errors: result.errors,
      };
    } catch (error) {
      logger.error(
        { error, pipelineId },
        "Manual pipeline batch scoring failed",
      );
      throw error;
    }
  }
}

// Export singleton instance
export const batchScoringScheduler = new BatchScoringScheduler();
