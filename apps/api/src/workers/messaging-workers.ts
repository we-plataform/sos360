import { Worker, Job, type JobsOptions } from 'bullmq';
import { prisma, type MessageQueueStatus } from '@lia360/database';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { linkedinMessenger } from '../lib/messengers/linkedin-messenger.js';
import { instagramMessenger } from '../lib/messengers/instagram-messenger.js';
import type { Platform } from '@lia360/database';

/**
 * Message job data structure
 */
export interface MessageJobData {
    messageQueueId: string;
    platform: Platform;
    messageType: 'connection_request' | 'dm' | 'follow_up';
    profileUrl: string;
    content: string;
    leadId: string;
    agentId: string;
    workspaceId: string;
}

/**
 * Message job result structure
 */
export interface MessageJobResult {
    success: boolean;
    messageQueueId: string;
    messageId?: string;
    error?: string;
    status: MessageQueueStatus;
}

/**
 * LinkedIn Messaging Worker
 *
 * Processes LinkedIn messages (connection requests and DMs) from the queue.
 * Handles rate limiting, errors, and status updates.
 */
class LinkedInMessagingWorker {
    private worker: Worker<MessageJobData, MessageJobResult> | null = null;

    /**
     * Start the LinkedIn messaging worker
     * @param concurrency - Number of concurrent jobs to process (default: 3)
     */
    start(concurrency = 3): void {
        if (this.worker) {
            logger.warn('LinkedInMessagingWorker: Worker already started');
            return;
        }

        if (!redis) {
            logger.warn('LinkedInMessagingWorker: Redis not available, worker not started');
            return;
        }

        this.worker = new Worker<MessageJobData, MessageJobResult>(
            'linkedin-messages',
            async (job: Job<MessageJobData>) => {
                return await this.processJob(job);
            },
            {
                connection: redis,
                concurrency,
                limiter: {
                    max: 10,
                    duration: 1000, // 10 messages per second max
                },
            }
        );

        this.worker.on('completed', (job, result) => {
            logger.info(
                {
                    jobId: job.id,
                    messageQueueId: result.messageQueueId,
                    status: result.status,
                },
                'LinkedInMessagingWorker: Job completed'
            );
        });

        this.worker.on('failed', (job, err) => {
            logger.error(
                {
                    jobId: job?.id,
                    messageQueueId: job?.data.messageQueueId,
                    err,
                },
                'LinkedInMessagingWorker: Job failed'
            );
        });

        logger.info('LinkedInMessagingWorker: Started');
    }

    /**
     * Process a single LinkedIn message job
     */
    private async processJob(job: Job<MessageJobData>): Promise<MessageJobResult> {
        const { messageQueueId, profileUrl, content, messageType, leadId, agentId } = job.data;

        try {
            await job.updateProgress(10);

            // Update status to processing
            await prisma.messageQueue.update({
                where: { id: messageQueueId },
                data: { status: 'processing' },
            });

            await job.updateProgress(20);

            // Get lead and agent details
            const [lead, agent] = await Promise.all([
                prisma.lead.findUnique({
                    where: { id: leadId },
                    select: { fullName: true, username: true },
                }),
                prisma.agent.findUnique({
                    where: { id: agentId },
                    select: { name: true },
                }),
            ]);

            if (!lead) {
                throw new Error(`Lead not found: ${leadId}`);
            }

            if (!agent) {
                throw new Error(`Agent not found: ${agentId}`);
            }

            await job.updateProgress(30);

            // Send message using LinkedInMessenger
            const result = await linkedinMessenger.sendMessage(
                profileUrl,
                content,
                messageType as 'connection_request' | 'dm' | 'follow_up'
            );

            await job.updateProgress(80);

            if (result.success) {
                // Update status to sent
                await prisma.messageQueue.update({
                    where: { id: messageQueueId },
                    data: {
                        status: 'sent',
                        sentAt: new Date(),
                        metadata: {
                            messageId: result.messageId,
                            ...result.metadata,
                        },
                    },
                });

                await job.updateProgress(100);

                logger.info(
                    {
                        messageQueueId,
                        leadId,
                        messageId: result.messageId,
                    },
                    'LinkedInMessagingWorker: Message sent successfully'
                );

                return {
                    success: true,
                    messageQueueId,
                    messageId: result.messageId,
                    status: 'sent',
                };
            } else {
                // Handle failure
                const isRetryable = result.retryable ?? false;
                const newStatus: MessageQueueStatus = isRetryable ? 'queued' : 'failed';

                await prisma.messageQueue.update({
                    where: { id: messageQueueId },
                    data: {
                        status: newStatus,
                        attempts: { increment: 1 },
                        lastError: result.error || 'Unknown error',
                    },
                });

                logger.warn(
                    {
                        messageQueueId,
                        leadId,
                        error: result.error,
                        retryable: isRetryable,
                    },
                    'LinkedInMessagingWorker: Message delivery failed'
                );

                return {
                    success: false,
                    messageQueueId,
                    error: result.error,
                    status: newStatus,
                };
            }
        } catch (error) {
            logger.error(
                {
                    err: error,
                    messageQueueId,
                    leadId,
                },
                'LinkedInMessagingWorker: Job processing error'
            );

            // Update status to failed on exception
            try {
                await prisma.messageQueue.update({
                    where: { id: messageQueueId },
                    data: {
                        status: 'failed',
                        attempts: { increment: 1 },
                        lastError: error instanceof Error ? error.message : 'Unknown error',
                    },
                });
            } catch (updateError) {
                logger.error({ err: updateError }, 'LinkedInMessagingWorker: Failed to update message status');
            }

            return {
                success: false,
                messageQueueId,
                error: error instanceof Error ? error.message : 'Unknown error',
                status: 'failed',
            };
        }
    }

    /**
     * Stop the worker gracefully
     */
    async stop(): Promise<void> {
        if (this.worker) {
            await this.worker.close();
            this.worker = null;
            logger.info('LinkedInMessagingWorker: Stopped');
        }
    }
}

/**
 * Instagram Messaging Worker
 *
 * Processes Instagram DMs from the queue.
 * Handles private account detection, rate limiting, errors, and status updates.
 */
class InstagramMessagingWorker {
    private worker: Worker<MessageJobData, MessageJobResult> | null = null;

    /**
     * Start the Instagram messaging worker
     * @param concurrency - Number of concurrent jobs to process (default: 3)
     */
    start(concurrency = 3): void {
        if (this.worker) {
            logger.warn('InstagramMessagingWorker: Worker already started');
            return;
        }

        if (!redis) {
            logger.warn('InstagramMessagingWorker: Redis not available, worker not started');
            return;
        }

        this.worker = new Worker<MessageJobData, MessageJobResult>(
            'instagram-messages',
            async (job: Job<MessageJobData>) => {
                return await this.processJob(job);
            },
            {
                connection: redis,
                concurrency,
                limiter: {
                    max: 10,
                    duration: 1000, // 10 messages per second max
                },
            }
        );

        this.worker.on('completed', (job, result) => {
            logger.info(
                {
                    jobId: job.id,
                    messageQueueId: result.messageQueueId,
                    status: result.status,
                },
                'InstagramMessagingWorker: Job completed'
            );
        });

        this.worker.on('failed', (job, err) => {
            logger.error(
                {
                    jobId: job?.id,
                    messageQueueId: job?.data.messageQueueId,
                    err,
                },
                'InstagramMessagingWorker: Job failed'
            );
        });

        logger.info('InstagramMessagingWorker: Started');
    }

    /**
     * Process a single Instagram message job
     */
    private async processJob(job: Job<MessageJobData>): Promise<MessageJobResult> {
        const { messageQueueId, profileUrl, content, messageType, leadId, agentId } = job.data;

        try {
            await job.updateProgress(10);

            // Update status to processing
            await prisma.messageQueue.update({
                where: { id: messageQueueId },
                data: { status: 'processing' },
            });

            await job.updateProgress(20);

            // Get lead and agent details
            const [lead, agent] = await Promise.all([
                prisma.lead.findUnique({
                    where: { id: leadId },
                    select: { fullName: true, username: true },
                }),
                prisma.agent.findUnique({
                    where: { id: agentId },
                    select: { name: true },
                }),
            ]);

            if (!lead) {
                throw new Error(`Lead not found: ${leadId}`);
            }

            if (!agent) {
                throw new Error(`Agent not found: ${agentId}`);
            }

            await job.updateProgress(30);

            // Send message using InstagramMessenger
            const result = await instagramMessenger.sendMessage(
                profileUrl,
                content,
                messageType as 'dm' | 'follow_up'
            );

            await job.updateProgress(80);

            if (result.success) {
                // Update status to sent
                await prisma.messageQueue.update({
                    where: { id: messageQueueId },
                    data: {
                        status: 'sent',
                        sentAt: new Date(),
                        metadata: {
                            messageId: result.messageId,
                            ...result.metadata,
                        },
                    },
                });

                await job.updateProgress(100);

                logger.info(
                    {
                        messageQueueId,
                        leadId,
                        messageId: result.messageId,
                    },
                    'InstagramMessagingWorker: Message sent successfully'
                );

                return {
                    success: true,
                    messageQueueId,
                    messageId: result.messageId,
                    status: 'sent',
                };
            } else {
                // Handle failure
                const isRetryable = result.retryable ?? false;
                const newStatus: MessageQueueStatus = isRetryable ? 'queued' : 'failed';

                await prisma.messageQueue.update({
                    where: { id: messageQueueId },
                    data: {
                        status: newStatus,
                        attempts: { increment: 1 },
                        lastError: result.error || 'Unknown error',
                    },
                });

                logger.warn(
                    {
                        messageQueueId,
                        leadId,
                        error: result.error,
                        retryable: isRetryable,
                    },
                    'InstagramMessagingWorker: Message delivery failed'
                );

                return {
                    success: false,
                    messageQueueId,
                    error: result.error,
                    status: newStatus,
                };
            }
        } catch (error) {
            logger.error(
                {
                    err: error,
                    messageQueueId,
                    leadId,
                },
                'InstagramMessagingWorker: Job processing error'
            );

            // Update status to failed on exception
            try {
                await prisma.messageQueue.update({
                    where: { id: messageQueueId },
                    data: {
                        status: 'failed',
                        attempts: { increment: 1 },
                        lastError: error instanceof Error ? error.message : 'Unknown error',
                    },
                });
            } catch (updateError) {
                logger.error({ err: updateError }, 'InstagramMessagingWorker: Failed to update message status');
            }

            return {
                success: false,
                messageQueueId,
                error: error instanceof Error ? error.message : 'Unknown error',
                status: 'failed',
            };
        }
    }

    /**
     * Stop the worker gracefully
     */
    async stop(): Promise<void> {
        if (this.worker) {
            await this.worker.close();
            this.worker = null;
            logger.info('InstagramMessagingWorker: Stopped');
        }
    }
}

// Export singleton instances
export const linkedinMessagingWorker = new LinkedInMessagingWorker();
export const instagramMessagingWorker = new InstagramMessagingWorker();

/**
 * Add a message to the appropriate queue
 */
export async function queueMessage(data: MessageJobData, options?: JobsOptions): Promise<void> {
    if (!redis) {
        logger.warn(
            {
                messageQueueId: data.messageQueueId,
                platform: data.platform,
            },
            'Redis not available, cannot queue message'
        );
        throw new Error('Redis not available');
    }

    const queueName = data.platform === 'linkedin' ? 'linkedin-messages' : 'instagram-messages';

    const { Queue } = await import('bullmq');
    const queue = new Queue(queueName, { connection: redis });

    await queue.add(queueName, data, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        ...options,
    });

    logger.info(
        {
            messageQueueId: data.messageQueueId,
            platform: data.platform,
            queueName,
        },
        'Message queued successfully'
    );

    await queue.close();
}
