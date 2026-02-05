import { Router } from "express";
import { prisma } from "@lia360/database";
import { authenticate, authorize } from "../middleware/auth.js";
import { NotFoundError } from "../lib/errors.js";
import { validate } from "../middleware/validate.js";
import { generateMessage } from "../lib/openai.js";

export const automationsRouter = Router();

// Schemas
import { upsertAutomationSchema, generateMessageSchema } from "@lia360/shared";

// All routes require authentication
automationsRouter.use(authenticate);

// Middleware to clean up expired locks (runs ~10% of the time)
automationsRouter.use(async (req, res, next) => {
  if (Math.random() < 0.1) {
    try {
      await prisma.automationLog.updateMany({
        where: {
          status: "running",
          lockedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) }, // 15 min timeout
        },
        data: {
          status: "failed",
          lockedAt: null,
          lockedBy: null,
          errorMessage: "Job timeout - lock expired",
        },
      });
    } catch (error) {
      // Log but don't block requests
      console.error("[Automations] Failed to cleanup expired locks:", error);
    }
  }
  next();
});

// POST /automations - Create or Update Automation for a Stage
automationsRouter.post(
  "/",
  authorize("owner", "admin", "manager"),
  validate(upsertAutomationSchema),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { pipelineStageId, name, actions, enabled } = req.body;

      // Verify stage belongs to workspace
      const stage = await prisma.pipelineStage.findFirst({
        where: {
          id: pipelineStageId,
          pipeline: { workspaceId },
        },
      });

      if (!stage) {
        throw new NotFoundError("Pipeline Stage");
      }

      // Check if automation already exists for this stage
      const existingAutomation = await prisma.automation.findFirst({
        where: {
          workspaceId,
          pipelineStageId,
        },
      });

      let automation;
      if (existingAutomation) {
        automation = await prisma.automation.update({
          where: { id: existingAutomation.id },
          data: {
            name,
            actions,
            enabled,
            triggerType: "manual", // Enforce manual for now as per MVP
            triggerConfig: {},
          },
        });
      } else {
        automation = await prisma.automation.create({
          data: {
            name,
            workspaceId,
            pipelineStageId,
            createdById: req.user!.id,
            actions,
            enabled,
            triggerType: "manual",
            triggerConfig: {},
          },
        });
      }

      res.json({
        success: true,
        data: automation,
      });
    } catch (error) {
      next(error);
    }
  },
);

// POST /automations/:id/trigger - Run automation manually (Queues the job)
automationsRouter.post(
  "/:id/trigger",
  authorize("owner", "admin", "manager", "agent"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;

      const automation = await prisma.automation.findFirst({
        where: { id, workspaceId, enabled: true },
        include: { pipelineStage: true },
      });

      if (!automation || !automation.pipelineStageId) {
        throw new NotFoundError("Automation");
      }

      // 1. Get leads in stage - ONLY those with profileUrl
      const { maxLeads, interval } = req.body;

      const leads = await prisma.lead.findMany({
        where: {
          workspaceId,
          pipelineStageId: automation.pipelineStageId,
          profileUrl: { not: null }, // Only leads with valid profile URLs
        },
        select: {
          id: true,
          profileUrl: true,
          fullName: true,
          username: true,
          platform: true,
          avatarUrl: true,
          bio: true,
        },
        take: maxLeads ? parseInt(maxLeads) : undefined,
      });

      // Filter out any leads with empty/invalid profileUrl (extra safety)
      const validLeads = leads.filter(
        (l) => l.profileUrl && l.profileUrl.trim() !== "",
      );

      if (validLeads.length === 0) {
        return res.json({
          success: false,
          error: {
            type: "validation_error",
            title: "No valid leads",
            detail: "No leads with valid profile URLs found in this stage",
          },
        });
      }

      // Create Automation Log entry as a "Job"
      const job = await prisma.automationLog.create({
        data: {
          automationId: automation.id,
          status: "pending",
          triggerType: "MANUAL",
          result: {
            leadsToProcess: validLeads.map((l) => ({
              ...l,
              platform: l.platform || "linkedin",
              // Ensure profileUrl is a valid LinkedIn URL
              profileUrl: l.profileUrl!.startsWith("http")
                ? l.profileUrl
                : `https://www.linkedin.com/in/${l.profileUrl}`,
            })),
            actions: automation.actions,
            config: {
              interval: interval || "60-90",
            },
          },
          startedAt: new Date(), // Job queued time
        },
      });

      res.json({
        success: true,
        data: {
          message: `Automation queued for ${validLeads.length} leads`,
          jobId: job.id,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// GET /automations/jobs - Poll for pending jobs (Called by Extension)
automationsRouter.get(
  "/jobs",
  authorize("owner", "admin", "manager", "agent"),
  async (req, res, next) => {
    try {
      const { workspaceId } = req.user!;

      // Find pending logs for automations in this workspace
      const jobs = await prisma.automationLog.findMany({
        where: {
          status: "pending",
          automation: {
            workspaceId: workspaceId,
          },
        },
        include: {
          automation: true,
        },
        orderBy: { startedAt: "asc" },
        take: 5, // Process a few at a time
      });

      res.json({
        success: true,
        data: jobs,
      });
    } catch (error) {
      next(error);
    }
  },
<<<<<<< HEAD
);

// POST /automations/jobs/claim - Claim a pending job with atomic locking
automationsRouter.post(
  "/jobs/claim",
  authorize("owner", "admin", "manager", "agent"),
  async (req, res, next) => {
    try {
      const { workspaceId } = req.user!;
      const { extensionId } = req.body;

      if (!extensionId) {
        return res.status(400).json({
          success: false,
          error: {
            type: "validation_error",
            title: "Missing extension ID",
            detail: "extensionId is required for job claiming",
          },
        });
      }

      // Find and lock a job atomically using transaction
      const job = await prisma.$transaction(async (tx) => {
        // Find a pending job that is not locked OR lock has expired (> 5 minutes)
        const candidate = await tx.automationLog.findFirst({
          where: {
            status: "pending",
            automation: { workspaceId },
            OR: [
              { lockedAt: null },
              { lockedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) }, }, // Lock expired (> 5 min)
            ],
          },
          include: { automation: true },
          orderBy: { startedAt: "asc" },
        });

        if (!candidate) {
          return null;
        }

        // Lock the job atomically
        const locked = await tx.automationLog.update({
          where: { id: candidate.id },
          data: {
            lockedAt: new Date(),
            lockedBy: extensionId,
            status: "running",
          },
        });

        return locked;
      });

      if (!job) {
        return res.json({ success: true, data: [] });
      }

      res.json({ success: true, data: [job] });
    } catch (error) {
      next(error);
    }
  },
=======
>>>>>>> origin/main
);

// PATCH /automations/jobs/:id - Update job status
automationsRouter.patch(
  "/jobs/:id",
  authorize("owner", "admin", "manager", "agent"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status, result } = req.body;

      // Map incoming status to valid enum values if necessary
      // Extension might send "COMPLETED", "FAILED" etc.
      let dbStatus = status;
      if (status === "COMPLETED" || status === "completed")
        dbStatus = "success";
      if (status === "FAILED" || status === "failed") dbStatus = "failed";
      if (status === "RUNNING" || status === "running") dbStatus = "running";

      const job = await prisma.automationLog.update({
        where: { id },
        data: {
          status: dbStatus,
          result: result ? result : undefined, // Merge or replace result
          completedAt:
            dbStatus === "success" || dbStatus === "failed"
              ? new Date()
              : undefined,
<<<<<<< HEAD
          // Clear lock when job is completed/failed
          lockedAt: dbStatus === "success" || dbStatus === "failed" ? null : undefined,
          lockedBy: dbStatus === "success" || dbStatus === "failed" ? null : undefined,
=======
>>>>>>> origin/main
        },
      });

      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  },
);

// POST /automations/generate-message - Generate AI message for a lead
automationsRouter.post(
  "/generate-message",
  authorize("owner", "admin", "manager", "agent"),
  validate(generateMessageSchema),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const {
        agentId,
        leadId,
        messageType = "first_message",
        context,
      } = req.body;

      // Fetch agent
      const agent = await prisma.agent.findFirst({
        where: {
          id: agentId,
          workspaceId,
          enabled: true,
        },
      });

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: {
            type: "not_found",
            title: "Agent not found",
            detail: "Agente AI não encontrado ou desabilitado",
          },
        });
      }

      // Fetch lead
      const lead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          workspaceId,
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
        },
      });

      if (!lead) {
        return res.status(404).json({
          success: false,
          error: {
            type: "not_found",
            title: "Lead not found",
            detail: "Lead não encontrado",
          },
        });
      }

      // Generate message using AI
      const result = await generateMessage(
        {
          systemPrompt: agent.systemPrompt,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          model: agent.model,
          type: agent.type,
        },
        {
          username: lead.username || "",
          fullName: lead.fullName,
          bio: lead.bio,
          headline: lead.headline,
          company: lead.company,
          industry: lead.industry,
          location: lead.location,
          connectionCount: lead.connectionCount,
          followersCount: lead.followersCount,
          followingCount: lead.followingCount,
          platform: lead.platform || undefined,
        },
        messageType,
        context,
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);
