import { Router } from 'express';
import { prisma } from '@lia360/database';
import {
  updateOnboardingProgressSchema,
  updateOnboardingStepSchema,
  completeOnboardingSchema,
} from '@lia360/shared';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../lib/errors.js';

export const onboardingRouter = Router();

onboardingRouter.use(authenticate);

/**
 * GET /onboarding
 * Get current user's onboarding progress with all steps
 */
onboardingRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.id;

    // Get or create onboarding progress
    let progress = await prisma.onboardingProgress.findUnique({
      where: { userId },
      include: {
        steps: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Create onboarding progress if it doesn't exist
    if (!progress) {
      progress = await prisma.onboardingProgress.create({
        data: {
          userId,
          status: 'not_started',
          steps: {
            create: [
              { stepType: 'install_extension', isCompleted: false },
              { stepType: 'create_pipeline', isCompleted: false },
              { stepType: 'capture_lead', isCompleted: false },
              { stepType: 'send_message', isCompleted: false },
              { stepType: 'create_automation', isCompleted: false },
              { stepType: 'create_audience', isCompleted: false },
              { stepType: 'import_leads', isCompleted: false },
              { stepType: 'setup_workspace', isCompleted: false },
            ],
          },
        },
        include: {
          steps: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    // Calculate progress
    const totalSteps = progress.steps.length;
    const completedSteps = progress.steps.filter((s) => s.isCompleted).length;
    const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    res.json({
      success: true,
      data: {
        id: progress.id,
        userId: progress.userId,
        persona: progress.persona,
        status: progress.status,
        completedAt: progress.completedAt,
        createdAt: progress.createdAt,
        updatedAt: progress.updatedAt,
        steps: progress.steps.map((step) => ({
          id: step.id,
          stepType: step.stepType,
          isCompleted: step.isCompleted,
          completedAt: step.completedAt,
          metadata: step.metadata,
        })),
        progress: {
          total: totalSteps,
          completed: completedSteps,
          percentage,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /onboarding/steps
 * Update a specific onboarding step
 */
onboardingRouter.post(
  '/steps',
  validate(updateOnboardingStepSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { stepType, isCompleted, metadata } = req.body;

      // Get or create onboarding progress
      let progress = await prisma.onboardingProgress.findUnique({
        where: { userId },
      });

      if (!progress) {
        progress = await prisma.onboardingProgress.create({
          data: {
            userId,
            status: isCompleted ? 'in_progress' : 'not_started',
          },
        });
      }

      // Update or create the step
      const step = await prisma.onboardingStep.upsert({
        where: {
          progressId_stepType: {
            progressId: progress.id,
            stepType,
          },
        },
        create: {
          progressId: progress.id,
          stepType,
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
          metadata: metadata || {},
        },
        update: {
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
          metadata: metadata || undefined,
        },
      });

      // Check if all steps are completed
      const allSteps = await prisma.onboardingStep.findMany({
        where: { progressId: progress.id },
      });

      const allCompleted = allSteps.every((s) => s.isCompleted);

      // Update progress status if all steps are completed
      if (allCompleted && progress.status !== 'completed') {
        await prisma.onboardingProgress.update({
          where: { id: progress.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        });
      } else if (isCompleted && progress.status === 'not_started') {
        await prisma.onboardingProgress.update({
          where: { id: progress.id },
          data: { status: 'in_progress' },
        });
      }

      res.json({
        success: true,
        data: {
          id: step.id,
          stepType: step.stepType,
          isCompleted: step.isCompleted,
          completedAt: step.completedAt,
          metadata: step.metadata,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /onboarding/complete
 * Mark onboarding as completed
 */
onboardingRouter.patch(
  '/complete',
  validate(completeOnboardingSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;

      // Get onboarding progress
      let progress = await prisma.onboardingProgress.findUnique({
        where: { userId },
        include: {
          steps: true,
        },
      });

      if (!progress) {
        throw new NotFoundError('Progresso de onboarding');
      }

      // Update all steps as completed
      await prisma.onboardingStep.updateMany({
        where: {
          progressId: progress.id,
          isCompleted: false,
        },
        data: {
          isCompleted: true,
          completedAt: new Date(),
        },
      });

      // Update progress status
      const updated = await prisma.onboardingProgress.update({
        where: { id: progress.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });

      res.json({
        success: true,
        data: {
          id: updated.id,
          userId: updated.userId,
          persona: updated.persona,
          status: updated.status,
          completedAt: updated.completedAt,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /onboarding
 * Update onboarding progress (persona, status)
 */
onboardingRouter.patch(
  '/',
  validate(updateOnboardingProgressSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { persona, status } = req.body;

      // Get or create onboarding progress
      let progress = await prisma.onboardingProgress.findUnique({
        where: { userId },
      });

      if (!progress) {
        progress = await prisma.onboardingProgress.create({
          data: {
            userId,
            persona,
            status: status || 'not_started',
          },
        });
      } else {
        progress = await prisma.onboardingProgress.update({
          where: { id: progress.id },
          data: {
            ...(persona !== undefined && { persona }),
            ...(status !== undefined && { status }),
          },
        });
      }

      res.json({
        success: true,
        data: {
          id: progress.id,
          userId: progress.userId,
          persona: progress.persona,
          status: progress.status,
          completedAt: progress.completedAt,
          createdAt: progress.createdAt,
          updatedAt: progress.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);
