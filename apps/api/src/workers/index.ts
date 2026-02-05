import { Queue, Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import {
    enrichmentWorker,
    type EnrichmentJobData,
    type EnrichmentJobResult,
} from './enrichment-worker.js';

/**
 * Enrichment queue for adding jobs
 * This queue is used by API endpoints to schedule enrichment jobs
 */
let enrichmentQueue: Queue<EnrichmentJobData, EnrichmentJobResult> | null = null;

/**
 * Initialize all workers and queues
 * Should be called when API server starts
 */
export async function initWorkers(): Promise<void> {
    if (!redis) {
        logger.warn('Redis not available, workers cannot be initialized');
        return;
    }

    try {
        // Initialize enrichment queue
        enrichmentQueue = new Queue<EnrichmentJobData, EnrichmentJobResult>(
            'enrichment',
            {
                connection: redis,
                defaultJobOptions: {
                    attempts: 3, // Retry failed jobs 3 times
                    backoff: {
                        type: 'exponential',
                        delay: 2000, // Start with 2s delay, then exponential
                    },
                    removeOnComplete: {
                        count: 1000, // Keep last 1000 completed jobs
                        age: 7 * 24 * 3600, // or 7 days
                    },
                    removeOnFail: {
                        count: 5000, // Keep last 5000 failed jobs
                        age: 30 * 24 * 3600, // or 30 days
                    },
                },
            }
        );

        logger.info('Enrichment queue initialized');

        // Start enrichment worker
        enrichmentWorker.start(3); // Process up to 3 jobs concurrently

        logger.info('All workers initialized successfully');
    } catch (error) {
        logger.error({ err: error }, 'Failed to initialize workers');
        throw error;
    }
}

/**
 * Stop all workers
 * Should be called when API server shuts down gracefully
 */
export async function stopWorkers(): Promise<void> {
    try {
        await enrichmentWorker.stop();

        if (enrichmentQueue) {
            await enrichmentQueue.close();
            enrichmentQueue = null;
        }

        logger.info('All workers stopped');
    } catch (error) {
        logger.error({ err: error }, 'Error stopping workers');
        throw error;
    }
}

/**
 * Add an enrichment job to the queue
 * @param data - Enrichment job data
 * @returns Job instance
 */
export async function addEnrichmentJob(
    data: EnrichmentJobData
): Promise<Job<EnrichmentJobData, EnrichmentJobResult>> {
    if (!enrichmentQueue) {
        throw new Error('Enrichment queue not initialized');
    }

    try {
        const job = await enrichmentQueue.add(
            'enrich-lead',
            data,
            {
                jobId: `enrich-${data.leadId}`, // Unique job ID per lead (prevents duplicates)
                priority: 1, // Normal priority
            }
        );

        logger.info(
            {
                jobId: job.id,
                leadId: data.leadId,
                workspaceId: data.workspaceId,
            },
            'Enrichment job added to queue'
        );

        return job;
    } catch (error) {
        logger.error(
            {
                err: error,
                leadId: data.leadId,
                workspaceId: data.workspaceId,
            },
            'Failed to add enrichment job to queue'
        );
        throw error;
    }
}

/**
 * Get enrichment job status
 * @param jobId - Job ID
 * @returns Job state and data
 */
export async function getEnrichmentJobStatus(
    jobId: string
): Promise<{
    id: string;
    state: string | null;
    data: EnrichmentJobData | undefined;
    result: EnrichmentJobResult | undefined;
    failedReason: string | undefined;
    processedOn: number | undefined;
    finishedOn: number | undefined;
} | null> {
    if (!enrichmentQueue) {
        throw new Error('Enrichment queue not initialized');
    }

    try {
        const job = await enrichmentQueue.getJob(jobId);

        if (!job) {
            return null;
        }

        const state = await job.getState();

        return {
            id: job.id || '',
            state,
            data: job.data,
            result: job.returnvalue,
            failedReason: job.failedReason,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
        };
    } catch (error) {
        logger.error({ err: error, jobId }, 'Failed to get enrichment job status');
        throw error;
    }
}

/**
 * Get queue statistics
 * @returns Queue stats
 */
export async function getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
}> {
    if (!enrichmentQueue) {
        throw new Error('Enrichment queue not initialized');
    }

    try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            enrichmentQueue.getWaitingCount(),
            enrichmentQueue.getActiveCount(),
            enrichmentQueue.getCompletedCount(),
            enrichmentQueue.getFailedCount(),
            enrichmentQueue.getDelayedCount(),
        ]);

        return {
            waiting,
            active,
            completed,
            failed,
            delayed,
        };
    } catch (error) {
        logger.error({ err: error }, 'Failed to get queue stats');
        throw error;
    }
}

/**
 * Retry a failed enrichment job
 * @param jobId - Job ID
 * @returns Updated job
 */
export async function retryEnrichmentJob(
    jobId: string
): Promise<Job<EnrichmentJobData, EnrichmentJobResult>> {
    if (!enrichmentQueue) {
        throw new Error('Enrichment queue not initialized');
    }

    try {
        const job = await enrichmentQueue.getJob(jobId);

        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }

        await job.retry();

        logger.info({ jobId }, 'Enrichment job retry requested');

        return job;
    } catch (error) {
        logger.error({ err: error, jobId }, 'Failed to retry enrichment job');
        throw error;
    }
}

// Export for testing/monitoring
export { enrichmentWorker };
