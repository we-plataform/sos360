import { prisma } from '@lia360/database';
import { logger } from '../lib/logger.js';
import { generateMessage, type LeadProfile } from '../lib/openai.js';
import { queueMessage } from '../workers/messaging-workers.js';
import type { Platform } from '@lia360/database';

/**
 * Social Seller Workflow Configuration
 */
export interface SocialSellerConfig {
    workspaceId: string;
    pipelineStageId: string;
    agentId: string;
    automationId?: string; // Optional automation ID for logging
    messageType: 'connection_request' | 'first_message' | 'follow_up';
    maxLeads?: number;
    delay?: {
        min?: number; // milliseconds
        max?: number; // milliseconds
    };
    scheduleForActiveHours?: boolean; // Only send during 09h-18h
    moveToNextStageOnSuccess?: boolean;
}

/**
 * Social Seller Workflow Result
 */
export interface SocialSellerResult {
    success: boolean;
    leadsProcessed: number;
    messagesQueued: number;
    messagesFailed: number;
    errors: Array<{
        leadId: string;
        leadName?: string;
        error: string;
    }>;
    automationLogId?: string;
}

/**
 * Social Seller Workflow Service
 *
 * Orchestrates the automated social selling workflow:
 * 1. Fetches leads in configured pipeline stage
 * 2. Generates personalized AI messages for each lead
 * 3. Queues messages for delivery via appropriate platform messenger
 * 4. Logs metrics and creates automation log entries
 * 5. Optionally moves leads to next stage after successful queuing
 */
export class SocialSellerWorkflow {
    /**
     * Execute the Social Seller workflow
     */
    async execute(config: SocialSellerConfig): Promise<SocialSellerResult> {
        const {
            workspaceId,
            pipelineStageId,
            agentId,
            messageType,
            maxLeads,
            delay,
            scheduleForActiveHours = true,
            moveToNextStageOnSuccess = false,
        } = config;

        logger.info(
            {
                workspaceId,
                pipelineStageId,
                agentId,
                messageType,
                maxLeads,
            },
            'SocialSellerWorkflow: Starting execution'
        );

        const result: SocialSellerResult = {
            success: false,
            leadsProcessed: 0,
            messagesQueued: 0,
            messagesFailed: 0,
            errors: [],
        };

        try {
            // 1. Verify pipeline stage belongs to workspace
            const stage = await prisma.pipelineStage.findFirst({
                where: {
                    id: pipelineStageId,
                    pipeline: { workspaceId },
                },
                include: {
                    pipeline: true,
                },
            });

            if (!stage) {
                throw new Error('Pipeline stage not found or does not belong to workspace');
            }

            // 2. Verify agent exists and is enabled
            const agent = await prisma.agent.findFirst({
                where: {
                    id: agentId,
                    workspaceId,
                    enabled: true,
                },
            });

            if (!agent) {
                throw new Error('AI agent not found or disabled');
            }

            // 3. Fetch leads in stage with enriched data
            const leads = await prisma.lead.findMany({
                where: {
                    workspaceId,
                    pipelineStageId,
                    profileUrl: { not: null },
                },
                select: {
                    id: true,
                    username: true,
                    fullName: true,
                    profileUrl: true,
                    avatarUrl: true,
                    bio: true,
                    platform: true,
                    location: true,
                    followersCount: true,
                    followingCount: true,
                    headline: true,
                    company: true,
                    industry: true,
                    connectionCount: true,
                    // Enriched data relations
                    experiences: {
                        select: {
                            companyName: true,
                            roleTitle: true,
                            employmentType: true,
                            location: true,
                            startDate: true,
                            endDate: true,
                            description: true,
                        },
                        take: 3,
                        orderBy: { startDate: 'desc' },
                    },
                    educations: {
                        select: {
                            school: true,
                            degree: true,
                            fieldOfStudy: true,
                            startDate: true,
                            endDate: true,
                        },
                        take: 2,
                    },
                    skills: {
                        select: {
                            name: true,
                            endorsementsCount: true,
                            category: true,
                        },
                        take: 10,
                        orderBy: { endorsementsCount: 'desc' },
                    },
                    certifications: {
                        select: {
                            name: true,
                            issuer: true,
                            issueDate: true,
                        },
                        take: 3,
                    },
                    leadPosts: {
                        select: {
                            content: true,
                            date: true,
                            likes: true,
                            comments: true,
                            shares: true,
                        },
                        take: 3,
                        orderBy: { date: 'desc' },
                    },
                },
                take: maxLeads,
            });

            // Filter out leads with invalid profile URLs
            const validLeads = leads.filter(
                (lead) => lead.profileUrl && lead.profileUrl.trim() !== ''
            );

            if (validLeads.length === 0) {
                logger.warn('SocialSellerWorkflow: No valid leads found in stage');
                return {
                    ...result,
                    success: true,
                    leadsProcessed: 0,
                };
            }

            result.leadsProcessed = validLeads.length;

            logger.info(
                {
                    totalLeads: leads.length,
                    validLeads: validLeads.length,
                },
                'SocialSellerWorkflow: Leads fetched successfully'
            );

            // 4. Calculate scheduling (active hours: 09h-18h)
            const scheduledAt = scheduleForActiveHours
                ? this.calculateScheduledTime(delay?.min, delay?.max)
                : null;

            // 5. Process each lead: generate message and queue for delivery
            for (const lead of validLeads) {
                try {
                    // Build lead profile for AI message generation
                    const leadProfile: LeadProfile = {
                        username: lead.username || '',
                        fullName: lead.fullName,
                        bio: lead.bio,
                        headline: lead.headline,
                        company: lead.company,
                        industry: lead.industry,
                        location: lead.location,
                        connectionCount: lead.connectionCount ?? undefined,
                        followersCount: lead.followersCount ?? undefined,
                        followingCount: lead.followingCount ?? undefined,
                        platform: lead.platform || undefined,
                        // Enriched data
                        experiences: lead.experiences.map((exp) => ({
                            companyName: exp.companyName,
                            roleTitle: exp.roleTitle,
                            employmentType: exp.employmentType ?? undefined,
                            location: exp.location ?? undefined,
                            startDate: exp.startDate ?? undefined,
                            endDate: exp.endDate ?? undefined,
                            description: exp.description ?? undefined,
                        })),
                        education: lead.educations.map((edu) => ({
                            school: edu.school,
                            degree: edu.degree ?? undefined,
                            fieldOfStudy: edu.fieldOfStudy ?? undefined,
                            startDate: edu.startDate ?? undefined,
                            endDate: edu.endDate ?? undefined,
                        })),
                        skills: lead.skills.map((skill) => ({
                            name: skill.name,
                            endorsementsCount: skill.endorsementsCount ?? undefined,
                            category: skill.category ?? undefined,
                        })),
                        certifications: lead.certifications.map((cert) => ({
                            name: cert.name,
                            issuingOrganization: cert.issuer ?? undefined,
                            issueDate: cert.issueDate ?? undefined,
                        })),
                        leadPosts: lead.leadPosts.map((post) => ({
                            content: post.content ?? undefined,
                            date: post.date ?? undefined,
                            likes: post.likes ?? undefined,
                            comments: post.comments ?? undefined,
                            shares: post.shares ?? undefined,
                        })),
                    };

                    // Generate AI message
                    const messageResult = await generateMessage(
                        {
                            systemPrompt: agent.systemPrompt,
                            temperature: agent.temperature,
                            maxTokens: agent.maxTokens,
                            model: agent.model,
                            type: agent.type,
                        },
                        leadProfile,
                        messageType
                    );

                    // Determine platform and message type for queue
                    const platform = (lead.platform || 'linkedin') as Platform;
                    const outreachType = messageType; // connection_request, first_message, follow_up

                    // Create message queue entry
                    const messageQueue = await prisma.messageQueue.create({
                        data: {
                            platform,
                            accountId: workspaceId, // Using workspaceId as account identifier
                            messageType: 'text', // All AI-generated messages are text
                            content: messageResult.message,
                            status: scheduledAt ? 'pending' : 'queued',
                            scheduledAt,
                            priority: this.getPriority(messageType),
                            metadata: {
                                profileUrl: lead.profileUrl,
                                confidenceScore: messageResult.confidenceScore,
                                outreachType, // Store the actual outreach type (connection_request, first_message, follow_up)
                                generatedBy: agent.name,
                                generatedByModel: messageResult.metadata.model,
                                tokensUsed: messageResult.metadata.tokensUsed,
                            },
                            leadId: lead.id,
                            agentId: agent.id,
                            workspaceId,
                        },
                    });

                    // Queue message for BullMQ worker processing
                    if (!scheduledAt || this.isPastOrPresent(scheduledAt)) {
                        await queueMessage(
                            {
                                messageQueueId: messageQueue.id,
                                platform,
                                messageType: outreachType === 'connection_request'
                                    ? 'connection_request'
                                    : platform === 'linkedin'
                                    ? 'dm'
                                    : 'dm',
                                profileUrl: lead.profileUrl!,
                                content: messageResult.message,
                                leadId: lead.id,
                                agentId: agent.id,
                                workspaceId,
                            },
                            {
                                delay: scheduledAt && this.isFuture(scheduledAt)
                                    ? scheduledAt.getTime() - Date.now()
                                    : undefined,
                            }
                        );
                    }

                    result.messagesQueued++;

                    logger.info(
                        {
                            leadId: lead.id,
                            leadName: lead.fullName,
                            messageQueueId: messageQueue.id,
                            platform,
                            confidenceScore: messageResult.confidenceScore,
                        },
                        'SocialSellerWorkflow: Message generated and queued'
                    );

                    // Optionally move lead to next stage
                    if (moveToNextStageOnSuccess) {
                        await this.moveToNextStage(lead.id, stage);
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    result.errors.push({
                        leadId: lead.id,
                        leadName: lead.fullName || undefined,
                        error: errorMessage,
                    });
                    result.messagesFailed++;

                    logger.error(
                        {
                            leadId: lead.id,
                            leadName: lead.fullName,
                            err: error,
                        },
                        'SocialSellerWorkflow: Failed to process lead'
                    );
                }
            }

            // 6. Create automation log entry (only if automationId is provided)
            let automationLogId: string | undefined;
            if (config.automationId) {
                const automationLog = await prisma.automationLog.create({
                    data: {
                        automationId: config.automationId,
                        status: result.messagesFailed === 0 ? 'success' : 'failed',
                        triggerType: 'WORKFLOW',
                        result: {
                            workflowType: 'SOCIAL_SELLER',
                            leadsProcessed: result.leadsProcessed,
                            messagesQueued: result.messagesQueued,
                            messagesFailed: result.messagesFailed,
                            errors: result.errors,
                            config: {
                                agentId,
                                messageType,
                                scheduledFor: scheduledAt?.toISOString(),
                            },
                        },
                        actionsExecuted: result.messagesQueued,
                        errorMessage:
                            result.messagesFailed > 0
                                ? `${result.messagesFailed} messages failed to queue`
                                : null,
                        metadata: {
                            workspaceId,
                            pipelineStageId,
                            agentName: agent.name,
                        },
                    },
                });
                automationLogId = automationLog.id;
            }

            result.automationLogId = automationLogId;
            result.success = result.messagesQueued > 0;

            logger.info(
                {
                    automationLogId,
                    leadsProcessed: result.leadsProcessed,
                    messagesQueued: result.messagesQueued,
                    messagesFailed: result.messagesFailed,
                },
                'SocialSellerWorkflow: Execution completed'
            );

            return result;
        } catch (error) {
            logger.error(
                {
                    err: error,
                    workspaceId,
                    pipelineStageId,
                },
                'SocialSellerWorkflow: Execution failed'
            );

            throw error;
        }
    }

    /**
     * Calculate priority based on message type
     * connection_request > first_message > follow_up
     */
    private getPriority(messageType: string): number {
        switch (messageType) {
            case 'connection_request':
                return 100;
            case 'first_message':
                return 50;
            case 'follow_up':
                return 10;
            default:
                return 0;
        }
    }

    /**
     * Calculate scheduled time for message delivery
     * Ensures message is sent during active hours (09h-18h)
     */
    private calculateScheduledTime(minDelay?: number, maxDelay?: number): Date | null {
        const now = new Date();
        const min = minDelay || 60 * 1000; // Default 1 minute minimum
        const max = maxDelay || 90 * 1000; // Default 1.5 minutes maximum

        // Add random delay
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        const scheduledTime = new Date(now.getTime() + delay);

        // Check if within active hours (09h-18h)
        const hour = scheduledTime.getHours();
        if (hour < 9 || hour >= 18) {
            // Schedule for 09h next day
            scheduledTime.setHours(9, 0, 0, 0);
            scheduledTime.setDate(scheduledTime.getDate() + 1);
        }

        return scheduledTime;
    }

    /**
     * Check if date is in the past or present
     */
    private isPastOrPresent(date: Date): boolean {
        return date.getTime() <= Date.now();
    }

    /**
     * Check if date is in the future
     */
    private isFuture(date: Date): boolean {
        return date.getTime() > Date.now();
    }

    /**
     * Move lead to the next stage in the pipeline
     */
    private async moveToNextStage(
        leadId: string,
        currentStage: { pipeline: { id: string }; order: number }
    ): Promise<void> {
        // Find next stage in pipeline
        const nextStage = await prisma.pipelineStage.findFirst({
            where: {
                pipelineId: currentStage.pipeline.id,
                order: { gt: currentStage.order },
            },
            orderBy: { order: 'asc' },
        });

        if (nextStage) {
            await prisma.lead.update({
                where: { id: leadId },
                data: { pipelineStageId: nextStage.id },
            });

            logger.info(
                {
                    leadId,
                    fromStageOrder: currentStage.order,
                    toStageOrder: nextStage.order,
                },
                'SocialSellerWorkflow: Lead moved to next stage'
            );
        } else {
            logger.warn(
                {
                    leadId,
                    currentStageOrder: currentStage.order,
                },
                'SocialSellerWorkflow: No next stage found, lead not moved'
            );
        }
    }
}

// Export singleton instance
export const socialSellerWorkflow = new SocialSellerWorkflow();

/**
 * Trigger Social Seller workflow for a pipeline stage
 * This is the main entry point for automation integrations
 */
export async function triggerSocialSellerWorkflow(
    config: SocialSellerConfig
): Promise<SocialSellerResult> {
    return await socialSellerWorkflow.execute(config);
}
