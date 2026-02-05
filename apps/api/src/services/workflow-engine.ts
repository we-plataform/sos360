import { prisma, Automation, AutomationLog, Lead } from '@lia360/database';
import { logger } from '../lib/logger.js';

/**
 * Workflow node types for advanced automation builder
 */
export type WorkflowNodeType = 'trigger' | 'action' | 'condition' | 'delay';

/**
 * Workflow node definition
 */
export type WorkflowNode = {
    id: string;
    type: WorkflowNodeType;
    name: string;
    config: any; // Configuration specific to node type
    position?: { x: number; y: number }; // Canvas position
};

/**
 * Workflow edge definition (connections between nodes)
 */
export type WorkflowEdge = {
    id: string;
    source: string; // Source node ID
    target: string; // Target node ID
    condition?: string; // Optional: condition label for branching
};

/**
 * Workflow definition structure
 */
export type WorkflowDefinition = {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    startNodeId?: string; // Optional: explicit start node (defaults to first trigger node)
};

/**
 * Execution context passed through workflow
 */
export type ExecutionContext = {
    lead: Lead;
    automation: Automation;
    workflowLog: AutomationLog;
    variables: Record<string, any>; // Variables that can be set/used by actions
    currentStep: number;
};

/**
 * Workflow execution result
 */
export type WorkflowExecutionResult = {
    success: boolean;
    logId: string;
    stepsExecuted: number;
    error?: string;
    output?: Record<string, any>;
};

/**
 * WorkflowEngine class for executing advanced automation workflows
 * Processes workflow definitions node by node with support for branching, delays, and conditions
 */
export class WorkflowEngine {
    /**
     * Execute a workflow definition for a specific lead
     * @param automation - The automation to execute
     * @param lead - The lead to run the workflow against
     * @param definition - The workflow definition with nodes and edges
     * @returns Execution result with log ID and status
     */
    async executeWorkflow(
        automation: Automation,
        lead: Lead,
        definition?: WorkflowDefinition
    ): Promise<WorkflowExecutionResult> {
        // Verify lead belongs to the same workspace as automation
        if (lead.workspaceId !== automation.workspaceId) {
            throw new Error('Lead does not belong to the automation workspace');
        }

        // Create execution log
        const workflowLog = await prisma.automationLog.create({
            data: {
                automationId: automation.id,
                leadId: lead.id,
                status: 'running',
                triggerType: automation.triggerType.toUpperCase() as any,
                metadata: {
                    automationName: automation.name,
                    leadEmail: lead.email,
                    workspaceId: automation.workspaceId,
                },
            },
        });

        logger.info(
            { automationId: automation.id, leadId: lead.id, logId: workflowLog.id },
            'Starting workflow execution'
        );

        const context: ExecutionContext = {
            lead,
            automation,
            workflowLog,
            variables: {},
            currentStep: 0,
        };

        try {
            // Parse workflow definition
            const workflowDef = definition || this.parseWorkflowDefinition(automation);

            // Validate workflow has nodes
            if (!workflowDef.nodes || workflowDef.nodes.length === 0) {
                throw new Error('Workflow definition has no nodes');
            }

            // Find start node (first trigger node or explicitly defined start)
            const startNodeId = workflowDef.startNodeId || this.findStartNode(workflowDef);
            if (!startNodeId) {
                throw new Error('Workflow has no valid start node');
            }

            // Execute workflow starting from start node
            await this.executeFromNode(workflowDef, startNodeId, context);

            // Update log to success
            await prisma.automationLog.update({
                where: { id: workflowLog.id },
                data: {
                    status: 'success',
                    completedAt: new Date(),
                    actionsExecuted: context.currentStep,
                    result: {
                        success: true,
                        stepsExecuted: context.currentStep,
                        variables: context.variables,
                    },
                },
            });

            // Update automation stats
            await this.updateAutomationStats(automation.id, true);

            logger.info(
                { automationId: automation.id, leadId: lead.id, logId: workflowLog.id, stepsExecuted: context.currentStep },
                'Workflow execution completed successfully'
            );

            return {
                success: true,
                logId: workflowLog.id,
                stepsExecuted: context.currentStep,
                output: context.variables,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Update log to failed
            await prisma.automationLog.update({
                where: { id: workflowLog.id },
                data: {
                    status: 'failed',
                    completedAt: new Date(),
                    errorMessage,
                    result: {
                        success: false,
                        error: errorMessage,
                        stepsExecuted: context.currentStep,
                    },
                },
            });

            // Update automation stats
            await this.updateAutomationStats(automation.id, false);

            logger.error(
                { err: error, automationId: automation.id, leadId: lead.id, logId: workflowLog.id },
                'Workflow execution failed'
            );

            return {
                success: false,
                logId: workflowLog.id,
                stepsExecuted: context.currentStep,
                error: errorMessage,
            };
        }
    }

    /**
     * Execute workflow starting from a specific node
     * @param definition - Workflow definition
     * @param nodeId - Starting node ID
     * @param context - Execution context
     */
    private async executeFromNode(
        definition: WorkflowDefinition,
        nodeId: string,
        context: ExecutionContext
    ): Promise<void> {
        const node = definition.nodes.find(n => n.id === nodeId);
        if (!node) {
            throw new Error(`Node ${nodeId} not found in workflow definition`);
        }

        // Create step record
        const step = await prisma.automationStep.create({
            data: {
                automationLogId: context.workflowLog.id,
                stepType: node.type,
                stepName: node.name,
                stepOrder: context.currentStep,
                input: node.config,
                status: 'running',
            },
        });

        logger.debug(
            { logId: context.workflowLog.id, stepId: step.id, nodeType: node.type, nodeName: node.name },
            'Executing workflow step'
        );

        try {
            let stepOutput: any = {};

            // Execute node based on type
            switch (node.type) {
                case 'trigger':
                    stepOutput = await this.executeTrigger(node, context);
                    break;
                case 'action':
                    stepOutput = await this.executeAction(node, context);
                    break;
                case 'condition':
                    stepOutput = await this.executeCondition(node, context);
                    break;
                case 'delay':
                    stepOutput = await this.executeDelay(node, context);
                    break;
                default:
                    throw new Error(`Unknown node type: ${node.type}`);
            }

            // Update step to success
            await prisma.automationStep.update({
                where: { id: step.id },
                data: {
                    status: 'success',
                    completedAt: new Date(),
                    output: stepOutput,
                },
            });

            context.currentStep++;

            // Find next nodes to execute
            const nextNodeIds = this.getNextNodeIds(definition, nodeId, stepOutput);
            if (nextNodeIds.length === 0) {
                logger.debug(
                    { logId: context.workflowLog.id, nodeId },
                    'No more nodes to execute, workflow complete'
                );
                return;
            }

            // Execute each next node (branching)
            for (const nextNodeId of nextNodeIds) {
                await this.executeFromNode(definition, nextNodeId, context);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Update step to failed
            await prisma.automationStep.update({
                where: { id: step.id },
                data: {
                    status: 'failed',
                    completedAt: new Date(),
                    errorMessage,
                },
            });

            throw error;
        }
    }

    /**
     * Execute a trigger node (validates trigger conditions)
     * @param node - Trigger node
     * @param context - Execution context
     * @returns Step output
     */
    private async executeTrigger(node: WorkflowNode, context: ExecutionContext): Promise<any> {
        const triggerType = node.config.type || 'manual';
        logger.debug({ triggerConfig: node.config, leadId: context.lead.id }, 'Evaluating trigger');

        try {
            let triggered = false;
            let triggerData: any = {};

            switch (triggerType) {
                case 'stage_change':
                    ({ triggered, triggerData } = await this.evaluateStageChangeTrigger(node.config, context.lead));
                    break;
                case 'tag_applied':
                    ({ triggered, triggerData } = await this.evaluateTagAppliedTrigger(node.config, context.lead));
                    break;
                case 'score_threshold':
                    ({ triggered, triggerData } = await this.evaluateScoreThresholdTrigger(node.config, context.lead));
                    break;
                case 'date_reached':
                    ({ triggered, triggerData } = await this.evaluateDateReachedTrigger(node.config, context.lead));
                    break;
                case 'webhook_received':
                    ({ triggered, triggerData } = await this.evaluateWebhookReceivedTrigger(node.config, context.lead));
                    break;
                case 'manual':
                    // Manual triggers always fire when executed
                    triggered = true;
                    triggerData = { manuallyTriggered: true };
                    break;
                default:
                    throw new Error(`Unknown trigger type: ${triggerType}`);
            }

            if (!triggered) {
                logger.debug(
                    { triggerType, triggerConfig: node.config, leadId: context.lead.id },
                    'Trigger condition not met'
                );
            }

            return {
                triggered,
                triggerType,
                ...triggerData,
            };
        } catch (error) {
            logger.error(
                { err: error, triggerType, triggerConfig: node.config, leadId: context.lead.id },
                'Error evaluating trigger'
            );
            throw error;
        }
    }

    /**
     * Evaluate stage change trigger
     * @param config - Trigger configuration
     * @param lead - Lead to evaluate
     * @returns Whether trigger fired and associated data
     */
    private async evaluateStageChangeTrigger(
        config: any,
        lead: Lead
    ): Promise<{ triggered: boolean; triggerData: any }> {
        const { fromStageId, toStageId } = config;

        // Check if lead is in the target stage
        if (!lead.pipelineStageId) {
            return { triggered: false, triggerData: { reason: 'Lead has no stage' } };
        }

        if (toStageId && lead.pipelineStageId !== toStageId) {
            return { triggered: false, triggerData: { reason: 'Lead not in target stage', currentStage: lead.pipelineStageId } };
        }

        // If fromStageId is specified, verify the lead was previously in that stage
        // This would require tracking stage history, which may not be available
        // For now, we just check that the lead is in the toStageId
        return {
            triggered: true,
            triggerData: {
                currentStageId: lead.pipelineStageId,
                fromStageId: fromStageId || null,
                toStageId,
            },
        };
    }

    /**
     * Evaluate tag applied trigger
     * @param config - Trigger configuration
     * @param lead - Lead to evaluate
     * @returns Whether trigger fired and associated data
     */
    private async evaluateTagAppliedTrigger(
        config: any,
        lead: Lead
    ): Promise<{ triggered: boolean; triggerData: any }> {
        const { tagId } = config;

        // Fetch lead with tags and include the tag data
        const leadWithTags = await prisma.lead.findUnique({
            where: { id: lead.id },
            include: {
                tags: {
                    include: {
                        tag: true,
                    },
                },
            },
        });

        if (!leadWithTags) {
            return { triggered: false, triggerData: { reason: 'Lead not found' } };
        }

        // Check if the tag is applied to the lead
        const matchingLeadTag = leadWithTags.tags.find((leadTag) => leadTag.tagId === tagId);

        if (!matchingLeadTag) {
            return {
                triggered: false,
                triggerData: { reason: 'Tag not applied to lead', tagId },
            };
        }

        return {
            triggered: true,
            triggerData: {
                tagId,
                tagName: matchingLeadTag.tag.name,
                tagColor: matchingLeadTag.tag.color,
                appliedAt: matchingLeadTag.createdAt,
            },
        };
    }

    /**
     * Evaluate score threshold trigger
     * @param config - Trigger configuration
     * @param lead - Lead to evaluate
     * @returns Whether trigger fired and associated data
     */
    private async evaluateScoreThresholdTrigger(
        config: any,
        lead: Lead
    ): Promise<{ triggered: boolean; triggerData: any }> {
        const { threshold, operator, scoreField = 'totalScore' } = config;

        // Get the score value from the lead's score field
        // Currently, we only support the main score field on the Lead model
        let scoreValue: number;

        if (scoreField === 'totalScore') {
            scoreValue = lead.score;
        } else {
            // For now, we only support the main score field
            // Other score fields (qualityScore, engagementScore) would require
            // additional fields on the Lead model or a separate scoring table
            return {
                triggered: false,
                triggerData: {
                    reason: `Score field ${scoreField} is not currently supported. Only 'totalScore' is available.`,
                },
            };
        }

        // Evaluate the condition
        let triggered = false;
        switch (operator) {
            case 'greater_than':
                triggered = scoreValue > threshold;
                break;
            case 'less_than':
                triggered = scoreValue < threshold;
                break;
            case 'equals':
                triggered = scoreValue === threshold;
                break;
            case 'greater_or_equal':
                triggered = scoreValue >= threshold;
                break;
            case 'less_or_equal':
                triggered = scoreValue <= threshold;
                break;
            default:
                throw new Error(`Unknown operator: ${operator}`);
        }

        return {
            triggered,
            triggerData: {
                scoreField,
                scoreValue,
                threshold,
                operator,
                conditionMet: triggered,
            },
        };
    }

    /**
     * Evaluate date reached trigger
     * @param config - Trigger configuration
     * @param lead - Lead to evaluate
     * @returns Whether trigger fired and associated data
     */
    private async evaluateDateReachedTrigger(
        config: any,
        lead: Lead
    ): Promise<{ triggered: boolean; triggerData: any }> {
        const { dateField, customDateValue, relativeOffset } = config;
        const now = new Date();

        let targetDate: Date | null = null;

        // Determine the target date based on the dateField
        switch (dateField) {
            case 'createdAt':
                targetDate = lead.createdAt;
                break;
            case 'lastContactedAt':
                // Use lastInteractionAt instead
                targetDate = lead.lastInteractionAt || null;
                break;
            case 'nextFollowUpAt':
                // This field doesn't exist yet on the Lead model
                // For now, we'll return false
                return {
                    triggered: false,
                    triggerData: {
                        reason: 'nextFollowUpAt field is not yet supported on Lead model',
                        dateField,
                    },
                };
            case 'customDate':
                if (!customDateValue) {
                    return { triggered: false, triggerData: { reason: 'customDateValue required for custom date field' } };
                }
                targetDate = new Date(customDateValue);
                break;
            default:
                throw new Error(`Unknown date field: ${dateField}`);
        }

        if (!targetDate) {
            return { triggered: false, triggerData: { reason: `Date field ${dateField} is not set` } };
        }

        // Apply relative offset if specified
        if (relativeOffset) {
            const { amount, unit, before = false } = relativeOffset;
            const offsetMs = this.convertToMilliseconds(amount, unit);

            if (before) {
                targetDate = new Date(targetDate.getTime() - offsetMs);
            } else {
                targetDate = new Date(targetDate.getTime() + offsetMs);
            }
        }

        // Check if the date has been reached
        const triggered = now >= targetDate;

        return {
            triggered,
            triggerData: {
                dateField,
                targetDate: targetDate.toISOString(),
                currentDate: now.toISOString(),
                reached: triggered,
            },
        };
    }

    /**
     * Evaluate webhook received trigger
     * @param config - Trigger configuration
     * @param lead - Lead to evaluate
     * @returns Whether trigger fired and associated data
     */
    private async evaluateWebhookReceivedTrigger(
        config: any,
        lead: Lead
    ): Promise<{ triggered: boolean; triggerData: any }> {
        const { webhookUrl, expectedEvent } = config;

        // Webhook triggers are typically evaluated when the webhook is received
        // This method checks if there's a recent webhook event that matches
        // In most cases, this trigger is activated by the webhook endpoint itself

        // Check for recent webhook events in the lead's metadata or automation logs
        const recentWebhookLogs = await prisma.automationLog.findMany({
            where: {
                leadId: lead.id,
                triggerType: 'WEBHOOK_RECEIVED',
                status: 'success',
                startedAt: {
                    gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
                },
            },
            orderBy: { startedAt: 'desc' },
            take: 1,
        });

        if (recentWebhookLogs.length === 0) {
            return {
                triggered: false,
                triggerData: { reason: 'No recent webhook events found' },
            };
        }

        const webhookLog = recentWebhookLogs[0];
        const webhookEventData = webhookLog.metadata as any;

        // Check if expected event matches (if specified)
        if (expectedEvent && webhookEventData.event !== expectedEvent) {
            return {
                triggered: false,
                triggerData: {
                    reason: 'Webhook event type does not match',
                    expected: expectedEvent,
                    received: webhookEventData.event,
                },
            };
        }

        return {
            triggered: true,
            triggerData: {
                webhookUrl,
                event: webhookEventData.event,
                receivedAt: webhookLog.startedAt,
                payload: webhookEventData.payload || {},
            },
        };
    }

    /**
     * Convert time amount to milliseconds
     * @param amount - Number of time units
     * @param unit - Time unit (milliseconds, seconds, minutes, hours, days)
     * @returns Milliseconds
     */
    private convertToMilliseconds(amount: number, unit: string): number {
        switch (unit) {
            case 'milliseconds':
                return amount;
            case 'seconds':
                return amount * 1000;
            case 'minutes':
                return amount * 60 * 1000;
            case 'hours':
                return amount * 60 * 60 * 1000;
            case 'days':
                return amount * 24 * 60 * 60 * 1000;
            default:
                throw new Error(`Unknown time unit: ${unit}. Supported units: milliseconds, seconds, minutes, hours, days`);
        }
    }

    /**
     * Execute an action node
     * @param node - Action node
     * @param context - Execution context
     * @returns Step output
     */
    private async executeAction(node: WorkflowNode, context: ExecutionContext): Promise<any> {
        const actionType = node.config.type;
        logger.debug({ actionConfig: node.config, leadId: context.lead.id }, 'Executing action');

        try {
            let result: any;

            switch (actionType) {
                case 'assign_user':
                    result = await this.executeAssignUserAction(node.config, context);
                    break;
                case 'add_tag':
                    result = await this.executeAddTagAction(node.config, context);
                    break;
                case 'send_message':
                    result = await this.executeSendMessageAction(node.config, context);
                    break;
                case 'update_field':
                    result = await this.executeUpdateFieldAction(node.config, context);
                    break;
                case 'wait_delay':
                    result = await this.executeWaitDelayAction(node.config, context);
                    break;
                case 'webhook_call':
                    result = await this.executeWebhookCallAction(node.config, context);
                    break;
                case 'javascript_code':
                    result = await this.executeJavascriptCodeAction(node.config, context);
                    break;
                default:
                    throw new Error(`Unknown action type: ${actionType}`);
            }

            return {
                actionType,
                executed: true,
                ...result,
            };
        } catch (error) {
            logger.error(
                { err: error, actionType, actionConfig: node.config, leadId: context.lead.id },
                'Error executing action'
            );
            throw error;
        }
    }

    /**
     * Execute assign_user action
     * Assigns a lead to a specific user
     */
    private async executeAssignUserAction(config: any, context: ExecutionContext): Promise<any> {
        const { userId } = config;

        if (!userId) {
            throw new Error('userId is required for assign_user action');
        }

        // Verify user belongs to the same workspace
        const user = await prisma.user.findFirst({
            where: {
                id: userId,
                workspaces: {
                    some: {
                        workspaceId: context.automation.workspaceId,
                    },
                },
            },
        });

        if (!user) {
            throw new Error(`User ${userId} not found in workspace`);
        }

        // Update lead assignment
        await prisma.lead.update({
            where: { id: context.lead.id },
            data: { assignedToId: userId },
        });

        // Create activity record
        await prisma.activity.create({
            data: {
                leadId: context.lead.id,
                userId: context.automation.createdById,
                type: 'assigned',
                description: `Lead assigned to ${user.fullName}`,
                metadata: {
                    automationId: context.automation.id,
                    assignedToUserId: userId,
                    assignedToUserName: user.fullName,
                },
            },
        });

        return {
            assigned: true,
            userId,
            userName: user.fullName,
        };
    }

    /**
     * Execute add_tag action
     * Adds a tag to a lead
     */
    private async executeAddTagAction(config: any, context: ExecutionContext): Promise<any> {
        const { tagId } = config;

        if (!tagId) {
            throw new Error('tagId is required for add_tag action');
        }

        // Verify tag belongs to the workspace
        const tag = await prisma.tag.findFirst({
            where: {
                id: tagId,
                workspaceId: context.automation.workspaceId,
            },
        });

        if (!tag) {
            throw new Error(`Tag ${tagId} not found in workspace`);
        }

        // Check if tag is already applied
        const existingLeadTag = await prisma.leadTag.findUnique({
            where: {
                leadId_tagId: {
                    leadId: context.lead.id,
                    tagId,
                },
            },
        });

        if (existingLeadTag) {
            return {
                added: false,
                tagId,
                tagName: tag.name,
                message: 'Tag already applied to lead',
            };
        }

        // Add tag to lead
        await prisma.leadTag.create({
            data: {
                leadId: context.lead.id,
                tagId,
            },
        });

        // Create activity record
        await prisma.activity.create({
            data: {
                leadId: context.lead.id,
                userId: context.automation.createdById,
                type: 'tag_added',
                description: `Tag "${tag.name}" added to lead`,
                metadata: {
                    automationId: context.automation.id,
                    tagId,
                    tagName: tag.name,
                },
            },
        });

        return {
            added: true,
            tagId,
            tagName: tag.name,
        };
    }

    /**
     * Execute send_message action
     * Sends a message to a lead (creates message record)
     */
    private async executeSendMessageAction(config: any, context: ExecutionContext): Promise<any> {
        const { content, messageType = 'text', metadata = {} } = config;

        if (!content) {
            throw new Error('content is required for send_message action');
        }

        // Get or create conversation
        let conversation = await prisma.conversation.findUnique({
            where: { leadId: context.lead.id },
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    leadId: context.lead.id,
                    platform: context.lead.platform || 'linkedin',
                    status: 'active',
                },
            });
        }

        // Create message record
        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                content,
                senderType: 'agent',
                messageType,
                senderId: context.automation.createdById,
                status: 'pending',
                metadata,
            },
        });

        // Update conversation last message timestamp
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: new Date() },
        });

        // Create activity record
        await prisma.activity.create({
            data: {
                leadId: context.lead.id,
                userId: context.automation.createdById,
                type: 'message_sent',
                description: 'Message sent via automation',
                metadata: {
                    automationId: context.automation.id,
                    messageId: message.id,
                    messageType,
                },
            },
        });

        return {
            sent: true,
            messageId: message.id,
            conversationId: conversation.id,
        };
    }

    /**
     * Execute update_field action
     * Updates any field on a lead
     */
    private async executeUpdateFieldAction(config: any, context: ExecutionContext): Promise<any> {
        const { field, value } = config;

        if (!field) {
            throw new Error('field is required for update_field action');
        }

        // Validate field name (prevent injection)
        const allowedFields = [
            'fullName',
            'email',
            'phone',
            'location',
            'bio',
            'company',
            'headline',
            'industry',
            'jobTitle',
            'notes',
            'status',
            'priority',
            'score',
            'pipelineStageId',
            'assignedToId',
        ];

        if (!allowedFields.includes(field)) {
            // Check if it's a custom field
            if (!field.startsWith('customFields.')) {
                throw new Error(`Field "${field}" is not allowed for update`);
            }
        }

        // Prepare update data
        let updateData: any = {};

        if (field.startsWith('customFields.')) {
            const customFieldKey = field.replace('customFields.', '');
            const lead = await prisma.lead.findUnique({
                where: { id: context.lead.id },
                select: { customFields: true },
            });

            const currentCustomFields = (lead?.customFields as any) || {};
            updateData.customFields = {
                ...currentCustomFields,
                [customFieldKey]: value,
            };
        } else {
            updateData[field] = value;
        }

        // Update lead
        await prisma.lead.update({
            where: { id: context.lead.id },
            data: updateData,
        });

        // Create activity record
        await prisma.activity.create({
            data: {
                leadId: context.lead.id,
                userId: context.automation.createdById,
                type: 'lead_updated',
                description: `Field "${field}" updated via automation`,
                metadata: {
                    automationId: context.automation.id,
                    field,
                    oldValue: (context.lead as any)[field],
                    newValue: value,
                },
            },
        });

        return {
            updated: true,
            field,
            value,
        };
    }

    /**
     * Execute wait_delay action
     * Waits for a specified duration before continuing
     */
    private async executeWaitDelayAction(config: any, _context: ExecutionContext): Promise<any> {
        const { duration, unit = 'milliseconds' } = config;

        if (duration == null) {
            throw new Error('duration is required for wait_delay action');
        }

        const delayMs = this.convertToMilliseconds(duration, unit);

        if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        return {
            delayed: true,
            duration,
            unit,
            delayMs,
        };
    }

    /**
     * Execute webhook_call action
     * Calls an external webhook with lead data, retry logic, and comprehensive error handling
     */
    private async executeWebhookCallAction(config: any, context: ExecutionContext): Promise<any> {
        const {
            url,
            method = 'POST',
            headers = {},
            bodyTemplate,
            retryConfig = {},
            timeout = 30000,
        } = config;

        if (!url) {
            throw new Error('url is required for webhook_call action');
        }

        // Extract retry configuration with defaults
        const {
            maxRetries = 3,
            initialDelayMs = 1000,
            backoffMultiplier = 2,
            retryableStatuses = [408, 429, 500, 502, 503, 504],
            retryableErrors = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'],
        } = retryConfig;

        // Prepare request body
        let body: any = {
            lead: {
                id: context.lead.id,
                fullName: context.lead.fullName,
                email: context.lead.email,
                phone: context.lead.phone,
                company: context.lead.company,
                headline: context.lead.headline,
                industry: context.lead.industry,
                location: context.lead.location,
                score: context.lead.score,
                status: context.lead.status,
                profileUrl: context.lead.profileUrl,
                platform: context.lead.platform,
            },
            automation: {
                id: context.automation.id,
                name: context.automation.name,
            },
            variables: context.variables,
            timestamp: new Date().toISOString(),
        };

        // Apply custom body template if provided
        if (bodyTemplate) {
            try {
                // Simple template variable replacement: {{lead.fullName}}, {{variables.foo}}, etc.
                const template = JSON.stringify(bodyTemplate);
                const rendered = template.replace(/\{\{([^}]+)\}\}/g, (_match, path) => {
                    const parts = path.trim().split('.');
                    let value: any = body;

                    for (const part of parts) {
                        if (value && typeof value === 'object' && part in value) {
                            value = value[part];
                        } else {
                            return '';
                        }
                    }

                    return typeof value === 'string' ? value : JSON.stringify(value);
                });

                body = JSON.parse(rendered);
            } catch (error) {
                logger.warn({ err: error, bodyTemplate }, 'Failed to render body template, using default');
            }
        }

        // Make webhook request with retry logic
        const startTime = Date.now();
        let response: any;
        let success = false;
        let errorMessage: string | undefined;
        let attempt = 0;
        let lastError: any = null;
        const retryHistory: Array<{ attempt: number; delay: number; error?: string; status?: number }> = [];

        while (attempt <= maxRetries) {
            attempt++;
            const attemptStartTime = Date.now();

            try {
                logger.debug(
                    {
                        url,
                        method,
                        attempt,
                        maxRetries,
                        leadId: context.lead.id,
                    },
                    'Executing webhook call'
                );

                const fetch = (await import('node-fetch')).default;

                // Create abort controller for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const responseObj = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Lia360-Webhook/1.0',
                        ...headers,
                    },
                    body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify(body) : undefined,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                response = {
                    status: responseObj.status,
                    statusText: responseObj.statusText,
                    headers: Object.fromEntries(responseObj.headers.entries()),
                };

                // Try to parse response body
                const contentType = responseObj.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    response.body = await responseObj.json();
                } else {
                    response.body = await responseObj.text();
                }

                const attemptDuration = Date.now() - attemptStartTime;
                success = responseObj.status >= 200 && responseObj.status < 300;

                if (success) {
                    // Successful request
                    logger.info(
                        {
                            url,
                            method,
                            status: responseObj.status,
                            attempt,
                            duration: attemptDuration,
                            leadId: context.lead.id,
                        },
                        'Webhook call succeeded'
                    );
                    break;
                }

                // Check if status is retryable
                const isRetryable = retryableStatuses.includes(responseObj.status);
                lastError = {
                    type: 'HTTP_ERROR',
                    status: responseObj.status,
                    statusText: responseObj.statusText,
                    message: `Webhook returned status ${responseObj.status}`,
                };

                retryHistory.push({
                    attempt,
                    delay: 0,
                    status: responseObj.status,
                });

                if (!isRetryable || attempt > maxRetries) {
                    // Non-retryable error or max retries exceeded
                    errorMessage = lastError.message;
                    logger.warn(
                        {
                            url,
                            status: responseObj.status,
                            attempt,
                            maxRetries,
                            isRetryable,
                            leadId: context.lead.id,
                        },
                        'Webhook call failed with non-retryable error or max retries exceeded'
                    );
                    break;
                }

                // Calculate delay for next retry with exponential backoff
                const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
                retryHistory[retryHistory.length - 1].delay = delay;

                logger.info(
                    {
                        url,
                        status: responseObj.status,
                        attempt,
                        nextRetryDelay: delay,
                        leadId: context.lead.id,
                    },
                    'Webhook call failed, retrying with exponential backoff'
                );

                // Wait before next retry
                await new Promise(resolve => setTimeout(resolve, delay));
            } catch (error) {
                const attemptDuration = Date.now() - attemptStartTime;
                const errorName = (error as any).code || (error as any).name || 'UNKNOWN';
                const errorMsg = error instanceof Error ? error.message : 'Unknown webhook error';

                lastError = {
                    type: 'NETWORK_ERROR',
                    code: errorName,
                    message: errorMsg,
                };

                retryHistory.push({
                    attempt,
                    delay: 0,
                    error: errorMsg,
                });

                // Check if error is retryable
                const isRetryable = retryableErrors.some(retryableError => errorMsg.includes(retryableError)) ||
                                   errorMsg.includes('timeout') ||
                                   errorMsg.includes('aborted');

                if (!isRetryable || attempt > maxRetries) {
                    // Non-retryable error or max retries exceeded
                    errorMessage = `Webhook request failed: ${errorMsg}`;
                    logger.error(
                        {
                            err: error,
                            url,
                            attempt,
                            maxRetries,
                            isRetryable,
                            duration: attemptDuration,
                            leadId: context.lead.id,
                        },
                        'Webhook call failed with non-retryable error or max retries exceeded'
                    );
                    break;
                }

                // Calculate delay for next retry with exponential backoff
                const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
                retryHistory[retryHistory.length - 1].delay = delay;

                logger.warn(
                    {
                        err: error,
                        url,
                        attempt,
                        nextRetryDelay: delay,
                        leadId: context.lead.id,
                    },
                    'Webhook request failed, retrying with exponential backoff'
                );

                // Wait before next retry
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        const totalDuration = Date.now() - startTime;

        // Create activity record
        await prisma.activity.create({
            data: {
                leadId: context.lead.id,
                userId: context.automation.createdById,
                type: 'automation_triggered',
                description: success
                    ? `Webhook called successfully after ${attempt} attempt${attempt > 1 ? 's' : ''}`
                    : `Webhook call failed after ${attempt} attempt${attempt > 1 ? 's' : ''}: ${errorMessage}`,
                metadata: {
                    automationId: context.automation.id,
                    url,
                    method,
                    success,
                    duration: totalDuration,
                    attempts: attempt,
                    retryHistory,
                    response: success ? response : lastError,
                },
            },
        });

        if (!success) {
            throw new Error(errorMessage || 'Webhook call failed after all retries');
        }

        return {
            success: true,
            url,
            method,
            duration: totalDuration,
            attempts: attempt,
            response,
        };
    }

    /**
     * Execute javascript_code action
     * Safely executes JavaScript code with access to lead data
     * Features security sandboxing, timeout enforcement, and comprehensive error handling
     */
    private async executeJavascriptCodeAction(config: any, context: ExecutionContext): Promise<any> {
        const { code, timeout = 5000 } = config;

        if (!code) {
            throw new Error('code is required for javascript_code action');
        }

        // Security: Validate code before execution
        this.validateJavaScriptCode(code);

        // Prepare sandbox context with read-only lead data
        const sandbox = {
            lead: this.createReadOnlyLeadObject(context.lead),
            automation: {
                id: context.automation.id,
                name: context.automation.name,
            },
            variables: { ...context.variables },
            result: undefined as any,
            logger: {
                info: (message: string, ...args: any[]) => {
                    logger.info({ message, args, automationId: context.automation.id });
                },
                warn: (message: string, ...args: any[]) => {
                    logger.warn({ message, args, automationId: context.automation.id });
                },
                error: (message: string, ...args: any[]) => {
                    logger.error({ message, args, automationId: context.automation.id });
                },
            },
            // Helper functions
            setVariable: (key: string, value: any) => {
                // Sanitize variable key to prevent injection
                if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
                    throw new Error(`Invalid variable name: ${key}`);
                }
                context.variables[key] = value;
            },
            getVariable: (key: string) => {
                return context.variables[key];
            },
        };

        try {
            // Create async function with sandbox context
            // We use a Function constructor to create a scoped execution
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
            const fn = new AsyncFunction(
                'lead',
                'automation',
                'variables',
                'result',
                'logger',
                'setVariable',
                'getVariable',
                `
                    "use strict";
                    try {
                        ${code}
                        return { success: true, result };
                    } catch (error) {
                        return { success: false, error: error.message || 'Unknown error' };
                    }
                `
            );

            // Execute with timeout enforcement
            const executionResult: { success: boolean; result?: any; error?: string } = await this.executeWithTimeout(
                fn(
                    sandbox.lead,
                    sandbox.automation,
                    sandbox.variables,
                    sandbox.result,
                    sandbox.logger,
                    sandbox.setVariable,
                    sandbox.getVariable
                ),
                timeout
            );

            if (!executionResult.success) {
                throw new Error(executionResult.error || 'JavaScript execution failed');
            }

            // Sanitize result before returning
            const sanitizedResult = this.sanitizeExecutionResult(executionResult.result);

            // Create activity record
            await prisma.activity.create({
                data: {
                    leadId: context.lead.id,
                    userId: context.automation.createdById,
                    type: 'automation_triggered',
                    description: 'JavaScript code executed successfully',
                    metadata: {
                        automationId: context.automation.id,
                        code: code.substring(0, 500), // Truncate for storage
                        result: sanitizedResult,
                    },
                },
            });

            return {
                executed: true,
                result: sanitizedResult,
                variables: context.variables,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('timed out');

            // Create activity record for failure
            await prisma.activity.create({
                data: {
                    leadId: context.lead.id,
                    userId: context.automation.createdById,
                    type: 'automation_triggered',
                    description: `JavaScript code execution failed: ${errorMessage}`,
                    metadata: {
                        automationId: context.automation.id,
                        code: code.substring(0, 500),
                        error: errorMessage,
                        timeout: isTimeout,
                    },
                },
            });

            throw new Error(`JavaScript execution failed: ${errorMessage}`);
        }
    }

    /**
     * Validate JavaScript code for security before execution
     * @param code - JavaScript code to validate
     * @throws Error if code contains dangerous patterns
     */
    private validateJavaScriptCode(code: string): void {
        // Check for dangerous patterns that could break out of sandbox
        const dangerousPatterns = [
            /require\s*\(/,
            /import\s+/,
            /eval\s*\(/,
            /Function\s*\(/,
            /process\./,
            /child_process/,
            /fs\./,
            /__dirname/,
            /__filename/,
            /\.\.[/\\]/, // Path traversal
            /global\./,
            /Reflect\./,
            /Proxy\s*\(/,
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(code)) {
                throw new Error(`Code contains forbidden pattern: ${pattern.source}`);
            }
        }

        // Limit code size to prevent memory exhaustion
        const maxCodeSize = 50000; // 50KB
        if (code.length > maxCodeSize) {
            throw new Error(`Code size exceeds maximum allowed size of ${maxCodeSize} bytes`);
        }
    }

    /**
     * Create a read-only copy of lead object to prevent modification
     * @param lead - Lead object
     * @returns Read-only lead object
     */
    private createReadOnlyLeadObject(lead: Lead): any {
        // Safely handle customFields which is a JsonValue type
        let customFieldsCopy: any = {};
        if (lead.customFields && typeof lead.customFields === 'object' && !Array.isArray(lead.customFields)) {
            customFieldsCopy = Object.freeze({ ...lead.customFields as object });
        }

        // Use Object.freeze to prevent modifications
        return Object.freeze({
            id: lead.id,
            fullName: lead.fullName,
            email: lead.email,
            phone: lead.phone,
            company: lead.company,
            headline: lead.headline,
            industry: lead.industry,
            location: lead.location,
            score: lead.score,
            status: lead.status,
            profileUrl: lead.profileUrl,
            platform: lead.platform,
            customFields: customFieldsCopy,
        });
    }

    /**
     * Execute a promise with timeout enforcement
     * @param promise - Promise to execute
     * @param timeoutMs - Timeout in milliseconds
     * @returns Promise result
     * @throws Error if timeout exceeded
     */
    private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        let timeoutHandle: NodeJS.Timeout | undefined;

        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(new Error(`JavaScript execution exceeded timeout of ${timeoutMs}ms`));
            }, timeoutMs);
        });

        try {
            return await Promise.race([promise, timeoutPromise]);
        } finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }

    /**
     * Sanitize execution result to prevent injection attacks
     * @param result - Result from JavaScript execution
     * @returns Sanitized result
     */
    private sanitizeExecutionResult(result: any): any {
        // Handle primitive types
        if (result === null || result === undefined) {
            return result;
        }

        // Handle primitives (string, number, boolean)
        if (typeof result !== 'object') {
            return result;
        }

        // Handle arrays
        if (Array.isArray(result)) {
            // Limit array size to prevent memory issues
            if (result.length > 1000) {
                return result.slice(0, 1000);
            }
            return result.map(item => this.sanitizeExecutionResult(item));
        }

        // Handle objects
        const sanitized: any = {};
        const keys = Object.keys(result);

        // Limit object size
        if (keys.length > 100) {
            keys.splice(100);
        }

        for (const key of keys) {
            // Skip non-string keys (potential injection)
            if (typeof key !== 'string') {
                continue;
            }

            // Skip keys that look like they could be dangerous
            if (key.startsWith('__') || key.includes('prototype') || key.includes('constructor')) {
                continue;
            }

            sanitized[key] = this.sanitizeExecutionResult(result[key]);
        }

        return sanitized;
    }

    /**
     * Execute a condition node
     * @param node - Condition node
     * @param context - Execution context
     * @returns Step output with branch result
     */
    private async executeCondition(node: WorkflowNode, context: ExecutionContext): Promise<any> {
        logger.debug({ conditionConfig: node.config }, 'Evaluating condition');

        try {
            // Extract condition configuration
            const { field, operator, value, caseSensitive = false } = node.config;

            // Get the actual value from the lead
            const actualValue = this.extractFieldValue(context.lead, field);

            // Evaluate the condition
            const conditionMet = this.evaluateCondition(actualValue, operator, value, caseSensitive);

            logger.debug(
                { field, operator, actualValue, expectedValue: value, conditionMet },
                'Condition evaluated'
            );

            // Determine which branch to take
            // 'then' branch for true, 'else' branch for false
            const branch = conditionMet ? 'then' : 'else';

            return {
                conditionMet,
                branch,
                field,
                operator,
                actualValue,
                expectedValue: value,
            };
        } catch (error) {
            logger.error({ err: error, conditionConfig: node.config }, 'Error evaluating condition');
            throw error;
        }
    }

    /**
     * Extract field value from lead object
     * @param lead - Lead object
     * @param field - Field name to extract
     * @returns Field value
     */
    private extractFieldValue(lead: Lead, field: string): any {
        // Handle direct field access
        if (field in lead) {
            return (lead as any)[field];
        }

        // Handle nested field access (e.g., linkedinHeadline)
        const parts = field.split('.');
        let value: any = lead;
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return null;
            }
        }
        return value;
    }

    /**
     * Evaluate a single condition
     * @param actualValue - Actual value from lead
     * @param operator - Comparison operator
     * @param expectedValue - Expected value to compare against
     * @param caseSensitive - Whether string comparison should be case sensitive
     * @returns Whether condition is met
     */
    private evaluateCondition(
        actualValue: any,
        operator: string,
        expectedValue: any,
        caseSensitive: boolean
    ): boolean {
        switch (operator) {
            case 'equals':
                return this.evaluateEquals(actualValue, expectedValue, caseSensitive);

            case 'not_equals':
                return !this.evaluateEquals(actualValue, expectedValue, caseSensitive);

            case 'contains':
                return this.evaluateContains(actualValue, expectedValue, caseSensitive);

            case 'not_contains':
                return !this.evaluateContains(actualValue, expectedValue, caseSensitive);

            case 'greater_than':
                return this.evaluateGreaterThan(actualValue, expectedValue);

            case 'less_than':
                return this.evaluateLessThan(actualValue, expectedValue);

            case 'greater_or_equal':
                return this.evaluateGreaterOrEqual(actualValue, expectedValue);

            case 'less_or_equal':
                return this.evaluateLessOrEqual(actualValue, expectedValue);

            case 'is_empty':
                return this.evaluateIsEmpty(actualValue);

            case 'is_not_empty':
                return !this.evaluateIsEmpty(actualValue);

            case 'starts_with':
                return this.evaluateStartsWith(actualValue, expectedValue, caseSensitive);

            case 'ends_with':
                return this.evaluateEndsWith(actualValue, expectedValue, caseSensitive);

            case 'in_array':
                return this.evaluateInArray(actualValue, expectedValue);

            case 'not_in_array':
                return !this.evaluateInArray(actualValue, expectedValue);

            default:
                throw new Error(`Unknown condition operator: ${operator}`);
        }
    }

    /**
     * Evaluate equals operator
     */
    private evaluateEquals(actual: any, expected: any, caseSensitive: boolean): boolean {
        // Handle null/undefined
        if (actual == null || expected == null) {
            return actual == expected;
        }

        // Handle string comparison
        if (typeof actual === 'string' && typeof expected === 'string') {
            return caseSensitive
                ? actual === expected
                : actual.toLowerCase() === expected.toLowerCase();
        }

        // Handle number/boolean comparison
        return actual === expected;
    }

    /**
     * Evaluate contains operator (string contains substring)
     */
    private evaluateContains(actual: any, expected: any, caseSensitive: boolean): boolean {
        if (typeof actual !== 'string' || typeof expected !== 'string') {
            return false;
        }

        const actualStr = caseSensitive ? actual : actual.toLowerCase();
        const expectedStr = caseSensitive ? expected : expected.toLowerCase();

        return actualStr.includes(expectedStr);
    }

    /**
     * Evaluate greater_than operator
     */
    private evaluateGreaterThan(actual: any, expected: any): boolean {
        const actualNum = this.toNumber(actual);
        const expectedNum = this.toNumber(expected);

        if (actualNum == null || expectedNum == null) {
            return false;
        }

        return actualNum > expectedNum;
    }

    /**
     * Evaluate less_than operator
     */
    private evaluateLessThan(actual: any, expected: any): boolean {
        const actualNum = this.toNumber(actual);
        const expectedNum = this.toNumber(expected);

        if (actualNum == null || expectedNum == null) {
            return false;
        }

        return actualNum < expectedNum;
    }

    /**
     * Evaluate greater_or_equal operator
     */
    private evaluateGreaterOrEqual(actual: any, expected: any): boolean {
        const actualNum = this.toNumber(actual);
        const expectedNum = this.toNumber(expected);

        if (actualNum == null || expectedNum == null) {
            return false;
        }

        return actualNum >= expectedNum;
    }

    /**
     * Evaluate less_or_equal operator
     */
    private evaluateLessOrEqual(actual: any, expected: any): boolean {
        const actualNum = this.toNumber(actual);
        const expectedNum = this.toNumber(expected);

        if (actualNum == null || expectedNum == null) {
            return false;
        }

        return actualNum <= expectedNum;
    }

    /**
     * Evaluate is_empty operator
     */
    private evaluateIsEmpty(actual: any): boolean {
        // null or undefined
        if (actual == null) {
            return true;
        }

        // Empty string
        if (typeof actual === 'string' && actual.trim() === '') {
            return true;
        }

        // Empty array
        if (Array.isArray(actual) && actual.length === 0) {
            return true;
        }

        // Empty object
        if (typeof actual === 'object' && Object.keys(actual).length === 0) {
            return true;
        }

        return false;
    }

    /**
     * Evaluate starts_with operator
     */
    private evaluateStartsWith(actual: any, expected: any, caseSensitive: boolean): boolean {
        if (typeof actual !== 'string' || typeof expected !== 'string') {
            return false;
        }

        const actualStr = caseSensitive ? actual : actual.toLowerCase();
        const expectedStr = caseSensitive ? expected : expected.toLowerCase();

        return actualStr.startsWith(expectedStr);
    }

    /**
     * Evaluate ends_with operator
     */
    private evaluateEndsWith(actual: any, expected: any, caseSensitive: boolean): boolean {
        if (typeof actual !== 'string' || typeof expected !== 'string') {
            return false;
        }

        const actualStr = caseSensitive ? actual : actual.toLowerCase();
        const expectedStr = caseSensitive ? expected : expected.toLowerCase();

        return actualStr.endsWith(expectedStr);
    }

    /**
     * Evaluate in_array operator
     */
    private evaluateInArray(actual: any, expected: any): boolean {
        if (!Array.isArray(expected)) {
            return false;
        }

        return expected.includes(actual);
    }

    /**
     * Convert value to number for numeric comparisons
     */
    private toNumber(value: any): number | null {
        if (typeof value === 'number') {
            return value;
        }

        if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? null : parsed;
        }

        return null;
    }

    /**
     * Execute a delay node
     * Pauses workflow execution for a specified duration
     * @param node - Delay node with config containing duration and unit
     * @param context - Execution context
     * @returns Step output with delay information
     */
    private async executeDelay(node: WorkflowNode, context: ExecutionContext): Promise<any> {
        const { duration = 0, unit = 'milliseconds' } = node.config;

        if (duration == null || duration < 0) {
            throw new Error('Invalid delay duration: must be a non-negative number');
        }

        logger.debug(
            { logId: context.workflowLog.id, duration, unit },
            'Executing delay node'
        );

        // Convert duration to milliseconds
        const delayMs = this.convertToMilliseconds(duration, unit);

        if (delayMs > 0) {
            // For short delays (< 5 minutes), use setTimeout
            // For longer delays, we would ideally use a job queue/scheduler
            // For now, we'll use setTimeout with a warning for long delays
            if (delayMs > 5 * 60 * 1000) {
                logger.warn(
                    { logId: context.workflowLog.id, delayMs, delayMinutes: delayMs / (60 * 1000) },
                    'Long delay detected - consider using a job scheduler for production'
                );
            }

            logger.debug(
                { logId: context.workflowLog.id, delayMs },
                `Pausing execution for ${delayMs}ms`
            );

            // Update workflow log to indicate it's waiting
            await prisma.automationLog.update({
                where: { id: context.workflowLog.id },
                data: {
                    metadata: {
                        ...(context.workflowLog.metadata as any),
                        delaying: true,
                        delayStartedAt: new Date().toISOString(),
                        delayDuration: delayMs,
                    },
                },
            });

            // Execute the delay
            await new Promise(resolve => setTimeout(resolve, delayMs));

            // Clear delay status from metadata
            await prisma.automationLog.update({
                where: { id: context.workflowLog.id },
                data: {
                    metadata: {
                        ...(context.workflowLog.metadata as any),
                        delaying: false,
                        delayCompletedAt: new Date().toISOString(),
                    },
                },
            });

            logger.debug(
                { logId: context.workflowLog.id, delayMs },
                'Delay completed, resuming workflow execution'
            );
        }

        return {
            delayed: true,
            duration,
            unit,
            delayMs,
        };
    }

    /**
     * Find the next node(s) to execute based on edges and current output
     * Supports branching based on condition evaluation results
     * @param definition - Workflow definition
     * @param currentNodeId - Current node ID
     * @param currentOutput - Output from current node execution (may contain branch info)
     * @returns Array of next node IDs to execute
     */
    private getNextNodeIds(
        definition: WorkflowDefinition,
        currentNodeId: string,
        currentOutput: any
    ): string[] {
        const outgoingEdges = definition.edges.filter(e => e.source === currentNodeId);

        if (outgoingEdges.length === 0) {
            return [];
        }

        // Handle branching from condition nodes
        // Condition nodes return output with 'branch' field ('then' or 'else')
        if (currentOutput && currentOutput.branch) {
            const branch = currentOutput.branch; // 'then' or 'else'

            // Find the edge that matches the branch
            const matchingEdge = outgoingEdges.find(e => e.condition === branch);

            if (matchingEdge) {
                logger.debug(
                    { currentNodeId, branch, nextNodeId: matchingEdge.target },
                    'Following conditional branch'
                );
                return [matchingEdge.target];
            }

            // No matching edge found for this branch
            logger.debug(
                { currentNodeId, branch, availableEdges: outgoingEdges.map(e => e.condition) },
                'No matching edge found for conditional branch, workflow ends'
            );
            return [];
        }

        // If no branching (simple linear flow), return single target
        if (outgoingEdges.length === 1) {
            return [outgoingEdges[0].target];
        }

        // Multiple outgoing edges without condition evaluation
        // Execute all branches (parallel execution)
        logger.debug(
            { currentNodeId, branchCount: outgoingEdges.length },
            'Multiple outgoing edges without condition, executing all branches'
        );
        return outgoingEdges.map(e => e.target);
    }

    /**
     * Find the start node in a workflow definition
     * @param definition - Workflow definition
     * @returns Start node ID or null
     */
    private findStartNode(definition: WorkflowDefinition): string | null {
        // Find first trigger node
        const triggerNode = definition.nodes.find(n => n.type === 'trigger');
        if (triggerNode) {
            return triggerNode.id;
        }

        // If no trigger node, use first node
        if (definition.nodes.length > 0) {
            return definition.nodes[0].id;
        }

        return null;
    }

    /**
     * Parse workflow definition from automation
     * @param automation - Automation object
     * @returns Workflow definition
     */
    private parseWorkflowDefinition(automation: Automation): WorkflowDefinition {
        // If automation has a modern workflow definition structure
        if (automation.triggerConfig && typeof automation.triggerConfig === 'object') {
            const config = automation.triggerConfig as any;
            if (config.nodes && config.edges) {
                return {
                    nodes: config.nodes,
                    edges: config.edges,
                    startNodeId: config.startNodeId,
                };
            }
        }

        // Legacy format: convert actions array to simple linear workflow
        const actions = automation.actions as any[];
        if (!Array.isArray(actions)) {
            return { nodes: [], edges: [] };
        }

        const nodes: WorkflowNode[] = actions.map((action, index) => ({
            id: `action-${index}`,
            type: 'action',
            name: action.name || `Action ${index + 1}`,
            config: action,
        }));

        // Create edges connecting actions sequentially
        const edges: WorkflowEdge[] = [];
        for (let i = 0; i < nodes.length - 1; i++) {
            edges.push({
                id: `edge-${i}`,
                source: nodes[i].id,
                target: nodes[i + 1].id,
            });
        }

        return { nodes, edges };
    }

    /**
     * Update automation execution statistics
     * @param automationId - Automation ID
     * @param success - Whether execution was successful
     */
    private async updateAutomationStats(automationId: string, success: boolean): Promise<void> {
        const automation = await prisma.automation.findUnique({
            where: { id: automationId },
        });

        if (!automation) {
            return;
        }

        const stats = automation.stats as any;
        const newStats = {
            runs: (stats.runs || 0) + 1,
            success: (stats.success || 0) + (success ? 1 : 0),
            failed: (stats.failed || 0) + (success ? 0 : 1),
        };

        await prisma.automation.update({
            where: { id: automationId },
            data: { stats: newStats },
        });
    }
}

/**
 * Execute workflow for multiple leads (batch execution)
 * @param automation - The automation to execute
 * @param leadIds - Array of lead IDs to execute workflow for
 * @param definition - Optional workflow definition
 * @returns Array of execution results
 */
export async function executeWorkflowBatch(
    automation: Automation,
    leadIds: string[],
    definition?: WorkflowDefinition
): Promise<Array<{ leadId: string; result: WorkflowExecutionResult }>> {
    const engine = new WorkflowEngine();
    const results: Array<{ leadId: string; result: WorkflowExecutionResult }> = [];

    for (const leadId of leadIds) {
        try {
            const lead = await prisma.lead.findUnique({
                where: { id: leadId },
            });

            if (!lead) {
                results.push({
                    leadId,
                    result: {
                        success: false,
                        logId: '',
                        stepsExecuted: 0,
                        error: `Lead ${leadId} not found`,
                    },
                });
                continue;
            }

            const result = await engine.executeWorkflow(automation, lead, definition);
            results.push({ leadId, result });
        } catch (error) {
            logger.error({ err: error, leadId }, 'Failed to execute workflow for lead in batch');
            results.push({
                leadId,
                result: {
                    success: false,
                    logId: '',
                    stepsExecuted: 0,
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
            });
        }
    }

    return results;
}
