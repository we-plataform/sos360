import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { enrichLead } from '../services/enrichment.js';

/**
 * Enrichment job data
 */
export interface EnrichmentJobData {
    leadId: string;
    workspaceId: string;
    userId?: string;
    force?: boolean; // Force re-enrichment even if already enriched
}

/**
 * Enrichment job result
 */
export interface EnrichmentJobResult {
    success: boolean;
    leadId: string;
    status: string;
    creditsUsed: number;
    confidenceScore: number;
    error?: string;
}

/**
 * BullMQ Worker for lead enrichment jobs
 * Processes enrichment requests asynchronously using external APIs
 */
class EnrichmentWorker {
    private worker: Worker<EnrichmentJobData, EnrichmentJobResult> | null = null;
    private isRunning = false;

    /**
     * Start the enrichment worker
     * @param concurrency - Number of jobs to process concurrently (default: 3)
     */
    start(concurrency = 3): void {
        if (this.isRunning) {
            logger.warn('Enrichment worker already running');
            return;
        }

        if (!redis) {
            logger.warn('Redis not available, enrichment worker cannot start');
            return;
        }

        try {
            this.worker = new Worker<EnrichmentJobData, EnrichmentJobResult>(
                'enrichment',
                async (job: Job<EnrichmentJobData>) => {
                    return await this.processJob(job);
                },
                {
                    connection: redis,
                    concurrency,
                    limiter: {
                        max: 10, // Max 10 jobs per interval
                        duration: 1000, // Per second
                    },
                }
            );

            this.worker.on('completed', (job, result) => {
                logger.info(
                    {
                        jobId: job.id,
                        leadId: job.data.leadId,
                        workspaceId: job.data.workspaceId,
                        result,
                    },
                    'Enrichment job completed'
                );
            });

            this.worker.on('failed', (job, err) => {
                logger.error(
                    {
                        jobId: job?.id,
                        leadId: job?.data.leadId,
                        workspaceId: job?.data.workspaceId,
                        err: err.message,
                    },
                    'Enrichment job failed'
                );
            });

            this.worker.on('error', (err) => {
                logger.error({ err }, 'Enrichment worker error');
            });

            this.isRunning = true;
            logger.info('Enrichment worker started');
        } catch (error) {
            logger.error({ err: error }, 'Failed to start enrichment worker');
            throw error;
        }
    }

    /**
     * Stop the enrichment worker
     */
    async stop(): Promise<void> {
        if (!this.isRunning || !this.worker) {
            return;
        }

        try {
            await this.worker.close();
            this.worker = null;
            this.isRunning = false;
            logger.info('Enrichment worker stopped');
        } catch (error) {
            logger.error({ err: error }, 'Error stopping enrichment worker');
            throw error;
        }
    }

    /**
     * Process an enrichment job
     * @param job - BullMQ job instance
     * @returns Job result
     */
    private async processJob(
        job: Job<EnrichmentJobData>
    ): Promise<EnrichmentJobResult> {
        const { leadId, workspaceId, userId } = job.data;

        logger.info(
            {
                jobId: job.id,
                leadId,
                workspaceId,
                userId,
            },
            'Processing enrichment job'
        );

        try {
            // Update job progress
            await job.updateProgress(10);

            // Call enrichment service
            const breakdown = await enrichLead(leadId, workspaceId);

            await job.updateProgress(100);

            return {
                success: breakdown.success,
                leadId,
                status: breakdown.status,
                creditsUsed: breakdown.creditsUsed,
                confidenceScore: breakdown.confidenceScore,
                error: breakdown.error,
            };
        } catch (error) {
            logger.error(
                {
                    jobId: job.id,
                    leadId,
                    workspaceId,
                    err: error instanceof Error ? error.message : 'Unknown error',
                },
                'Error processing enrichment job'
            );

            throw error; // Re-throw to mark job as failed
        }
    }

    /**
     * Get worker instance (for testing/monitoring)
     */
    getWorker(): Worker<EnrichmentJobData, EnrichmentJobResult> | null {
        return this.worker;
    }

    /**
     * Check if worker is running
     */
    isActive(): boolean {
        return this.isRunning;
    }
}

// Export singleton instance
export const enrichmentWorker = new EnrichmentWorker();
