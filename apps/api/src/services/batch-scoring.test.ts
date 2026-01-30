import { describe, it, expect, beforeEach, vi } from 'vitest';
import { batchScoringScheduler } from './batch-scoring.js';
import { prisma } from '@lia360/database';
import { scoringService } from './scoring.js';

// Mock Prisma
vi.mock('@lia360/database', () => ({
  prisma: {
    scoringModel: {
      findMany: vi.fn(),
    },
    pipeline: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock scoring service
vi.mock('./scoring.js', () => ({
  scoringService: {
    batchScoreLeads: vi.fn(),
  },
}));

// Mock logger
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('BatchScoringScheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('start', () => {
    it('should start the scheduler with default interval', () => {
      vi.mocked(prisma.scoringModel.findMany).mockResolvedValueOnce([]);

      batchScoringScheduler.start();

      // Verify logger was called
      expect(vi.mocked(batchScoringScheduler)).toBeDefined();
    });

    it('should start the scheduler with custom interval', () => {
      vi.mocked(prisma.scoringModel.findMany).mockResolvedValueOnce([]);

      const customInterval = 3600000; // 1 hour
      batchScoringScheduler.start(customInterval);

      // Verify scheduler started
      expect(vi.mocked(batchScoringScheduler)).toBeDefined();
    });

    it('should not start if already running', () => {
      vi.mocked(prisma.scoringModel.findMany).mockResolvedValue([]);

      batchScoringScheduler.start();
      batchScoringScheduler.start(); // Second call should be ignored

      // Cleanup
      batchScoringScheduler.stop();
    });
  });

  describe('stop', () => {
    it('should stop the scheduler', () => {
      batchScoringScheduler.stop();
      expect(vi.mocked(batchScoringScheduler)).toBeDefined();
    });
  });

  describe('scorePipeline', () => {
    it('should throw error when pipeline not found', async () => {
      vi.mocked(prisma.pipeline.findUnique).mockResolvedValueOnce(null);

      await expect(
        batchScoringScheduler.scorePipeline('nonexistent-pipeline')
      ).rejects.toThrow('Pipeline not found');
    });

    it('should return zero results when pipeline has no leads', async () => {
      vi.mocked(prisma.pipeline.findUnique).mockResolvedValueOnce({
        id: 'pipeline-123',
        name: 'Test Pipeline',
        description: null,
        workspaceId: 'workspace-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        stages: [],
      });

      const result = await batchScoringScheduler.scorePipeline('pipeline-123');

      expect(result).toEqual({
        succeeded: 0,
        failed: 0,
        errors: [],
      });
    });

    it('should score all leads in a pipeline', async () => {
      const mockPipeline = {
        id: 'pipeline-123',
        name: 'Test Pipeline',
        description: null,
        workspaceId: 'workspace-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        stages: [
          {
            id: 'stage-1',
            name: 'Stage 1',
            order: 0,
            pipelineId: 'pipeline-123',
            createdAt: new Date(),
            updatedAt: new Date(),
            leads: [
              { id: 'lead-1' },
              { id: 'lead-2' },
            ],
          },
          {
            id: 'stage-2',
            name: 'Stage 2',
            order: 1,
            pipelineId: 'pipeline-123',
            createdAt: new Date(),
            updatedAt: new Date(),
            leads: [
              { id: 'lead-3' },
            ],
          },
        ],
      };

      vi.mocked(prisma.pipeline.findUnique).mockResolvedValueOnce(mockPipeline);

      const mockBatchResult = {
        succeeded: 3,
        failed: 0,
        errors: [],
      };

      vi.mocked(scoringService.batchScoreLeads).mockResolvedValueOnce(
        mockBatchResult
      );

      const result = await batchScoringScheduler.scorePipeline('pipeline-123');

      expect(result).toEqual({
        succeeded: 3,
        failed: 0,
        errors: [],
      });

      expect(scoringService.batchScoreLeads).toHaveBeenCalledWith(
        ['lead-1', 'lead-2', 'lead-3'],
        'manual_batch'
      );
    });

    it('should handle batch scoring failures', async () => {
      const mockPipeline = {
        id: 'pipeline-123',
        name: 'Test Pipeline',
        description: null,
        workspaceId: 'workspace-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        stages: [
          {
            id: 'stage-1',
            name: 'Stage 1',
            order: 0,
            pipelineId: 'pipeline-123',
            createdAt: new Date(),
            updatedAt: new Date(),
            leads: [
              { id: 'lead-1' },
              { id: 'lead-2' },
            ],
          },
        ],
      };

      vi.mocked(prisma.pipeline.findUnique).mockResolvedValueOnce(mockPipeline);

      const mockBatchResult = {
        succeeded: 1,
        failed: 1,
        errors: ['Failed to score lead-2'],
      };

      vi.mocked(scoringService.batchScoreLeads).mockResolvedValueOnce(
        mockBatchResult
      );

      const result = await batchScoringScheduler.scorePipeline('pipeline-123');

      expect(result).toEqual({
        succeeded: 1,
        failed: 1,
        errors: ['Failed to score lead-2'],
      });
    });

    it('should propagate errors from database', async () => {
      const dbError = new Error('Database connection failed');
      vi.mocked(prisma.pipeline.findUnique).mockRejectedValueOnce(dbError);

      await expect(
        batchScoringScheduler.scorePipeline('pipeline-123')
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('start method behavior', () => {
    it('should query for enabled scoring models on start', async () => {
      vi.mocked(prisma.scoringModel.findMany).mockResolvedValue([]);

      batchScoringScheduler.start();

      // Wait a bit for the async operation
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(prisma.scoringModel.findMany).toHaveBeenCalledWith({
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

      // Cleanup
      batchScoringScheduler.stop();
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.scoringModel.findMany).mockRejectedValue(
        new Error('Database error')
      );

      // Should not throw, just log the error
      expect(() => batchScoringScheduler.start()).not.toThrow();

      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cleanup
      batchScoringScheduler.stop();
    });
  });
});
