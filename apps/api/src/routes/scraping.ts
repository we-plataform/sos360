import { Router } from 'express';
import { prisma } from '@lia360/database';
import {
  createScrapingJobSchema,
  scrapingJobFiltersSchema,
  scrapingJobStatusSchema,
  PAGINATION_DEFAULTS,
  calculateOffset,
  calculateTotalPages,
  parseSort,
} from '@lia360/shared';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../lib/errors.js';
import { scrapingRateLimit } from '../middleware/rate-limit.js';
import { z } from 'zod';
import { Queue } from 'bullmq';
import { redis } from '../lib/redis.js';

export const scrapingRouter = Router();

// Get or create scraping jobs queue
const getScrapingQueue = (): Queue | null => {
  if (!redis) {
    return null;
  }
  return new Queue('scraping-jobs', {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  });
};

// All routes require authentication
scrapingRouter.use(authenticate);

// GET / - List scraping jobs
scrapingRouter.get('/', validate(scrapingJobFiltersSchema, 'query'), async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const {
      page = PAGINATION_DEFAULTS.page,
      limit = PAGINATION_DEFAULTS.limit,
      status,
      platform,
      sort,
    } = req.query as z.infer<typeof scrapingJobFiltersSchema>;

    const { field: sortField, direction: sortDirection } = parseSort(sort);

    // Build where clause
    const where: Record<string, unknown> = { workspaceId };

    if (status) where.status = status;
    if (platform) where.platform = platform;

    const [jobs, total] = await Promise.all([
      prisma.scrapingJob.findMany({
        where,
        orderBy: { [sortField]: sortDirection },
        skip: calculateOffset(page, limit),
        take: limit,
      }),
      prisma.scrapingJob.count({ where }),
    ]);

    res.json({
      success: true,
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: calculateTotalPages(total, limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /:id - Get single scraping job
scrapingRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    const job = await prisma.scrapingJob.findFirst({
      where: { id, workspaceId },
    });

    if (!job) {
      throw new NotFoundError('Scraping job');
    }

    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
});

// POST / - Create scraping job
scrapingRouter.post('/', authorize('owner', 'admin', 'manager'), scrapingRateLimit, validate(createScrapingJobSchema), async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const { urls, platform, metadata } = req.body;

    // Validate platform
    const validPlatforms = ['linkedin', 'instagram', 'facebook', 'twitter', 'x'];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: `Plataforma inválida. Plataformas suportadas: ${validPlatforms.join(', ')}`,
      });
    }

    // Create scraping job in database
    const job = await prisma.scrapingJob.create({
      data: {
        workspaceId,
        platform,
        urls,
        status: 'pending',
        metadata: metadata || {},
      },
    });

    // Add job to queue
    const queue = getScrapingQueue();
    if (queue) {
      await queue.add(
        'scrape',
        {
          jobId: job.id,
          urls,
          platform,
          workspaceId,
        },
        {
          jobId: job.id,
        }
      );
    } else {
      // If Redis is not available, update job status to failed
      await prisma.scrapingJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errors: ['Redis não disponível. Serviço de fila está inativo.'],
        },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: job.id,
        status: job.status,
        urls: job.urls,
        platform: job.platform,
        createdAt: job.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});
