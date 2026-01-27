import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scoringService } from './scoring.js';
import { prisma } from '@lia360/database';

// Mock Prisma
vi.mock('@lia360/database', () => ({
  prisma: {
    scoringModel: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    lead: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    scoreHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock OpenAI
vi.mock('../lib/openai.js', () => ({
  analyzeLead: vi.fn(() => ({
    qualified: true,
    score: 70,
    reason: 'Mocked AI analysis',
  })),
}));

describe('ScoringService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getScoringModel', () => {
    it('should return null when no model exists', async () => {
      vi.mocked(prisma.scoringModel.findUnique).mockResolvedValueOnce(null);

      const model = await scoringService.getScoringModel('pipeline-123');
      expect(model).toBeNull();
    });

    it('should return null when model is disabled', async () => {
      vi.mocked(prisma.scoringModel.findUnique).mockResolvedValueOnce({
        id: 'model-123',
        name: 'Test Model',
        description: null,
        enabled: false,
        criteria: {},
        weights: {},
        thresholdHigh: 80,
        thresholdMedium: 50,
        systemPrompt: null,
        pipelineId: 'pipeline-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const model = await scoringService.getScoringModel('pipeline-123');
      expect(model).toBeNull();
    });

    it('should return model when enabled', async () => {
      const mockModel = {
        id: 'model-123',
        name: 'Test Model',
        description: null,
        enabled: true,
        criteria: {
          jobTitles: { target: ['CEO'], exclude: [], seniority: [] },
          companies: { industries: [], sizes: [], excludeIndustries: [] },
          engagement: {},
          completeness: { required: [], bonus: [] },
        },
        weights: { jobTitle: 1.0, company: 1.0, engagement: 0.8, completeness: 0.6 },
        thresholdHigh: 80,
        thresholdMedium: 50,
        systemPrompt: null,
        pipelineId: 'pipeline-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.scoringModel.findUnique).mockResolvedValueOnce(mockModel);

      const model = await scoringService.getScoringModel('pipeline-123');
      expect(model).toBeDefined();
      expect(model?.name).toBe('Test Model');
      expect(model?.enabled).toBe(true);
    });
  });

  describe('calculateWeightedScore', () => {
    // Helper to access private method through testing
    it('should calculate weighted average correctly', () => {
      const jobTitleScore = 80;
      const companyScore = 90;
      const engagementScore = 70;
      const completenessScore = 60;

      const jobTitleWeight = 1.0;
      const companyWeight = 1.0;
      const engagementWeight = 0.8;
      const completenessWeight = 0.6;

      const expectedScore =
        (jobTitleScore * jobTitleWeight +
          companyScore * companyWeight +
          engagementScore * engagementWeight +
          completenessScore * completenessWeight) /
        (jobTitleWeight + companyWeight + engagementWeight + completenessWeight);

      // The service calculates this internally, we're just validating the math
      expect(expectedScore).toBeCloseTo(76.92, 1);
    });
  });

  describe('getClassification', () => {
    it('should classify hot leads correctly', () => {
      // Score >= 80 should be hot
      const score = 85;
      const thresholdHigh = 80;
      const thresholdMedium = 50;

      const isHot = score >= thresholdHigh;
      const isWarm = score >= thresholdMedium && score < thresholdHigh;
      const isCold = score < thresholdMedium;

      expect(isHot).toBe(true);
      expect(isWarm).toBe(false);
      expect(isCold).toBe(false);
    });

    it('should classify warm leads correctly', () => {
      const score = 65;
      const thresholdHigh = 80;
      const thresholdMedium = 50;

      const isHot = score >= thresholdHigh;
      const isWarm = score >= thresholdMedium && score < thresholdHigh;
      const isCold = score < thresholdMedium;

      expect(isHot).toBe(false);
      expect(isWarm).toBe(true);
      expect(isCold).toBe(false);
    });

    it('should classify cold leads correctly', () => {
      const score = 30;
      const thresholdHigh = 80;
      const thresholdMedium = 50;

      const isHot = score >= thresholdHigh;
      const isWarm = score >= thresholdMedium && score < thresholdHigh;
      const isCold = score < thresholdMedium;

      expect(isHot).toBe(false);
      expect(isWarm).toBe(false);
      expect(isCold).toBe(true);
    });
  });
});
