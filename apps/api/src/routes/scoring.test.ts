import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { scoringRouter } from './scoring.js';

// Mock dependencies
vi.mock('@lia360/database');
vi.mock('../services/scoring.js');
vi.mock('../middleware/auth.js', () => ({
  authenticate: (_req: any, _res: any, next: any) => {
    _req.user = {
      id: 'user-123',
      workspaceId: 'workspace-123',
      workspaceRole: 'admin',
    };
    next();
  },
  authorize: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
}));

const { scoringService } = await import('../services/scoring.js');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1', scoringRouter);

describe('Scoring API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /pipelines/:pipelineId/scoring-model', () => {
    it('should return 404 when model not found', async () => {
      vi.mocked(scoringService.getScoringModel).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/pipelines/pipeline-123/scoring-model')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return scoring model when found', async () => {
      const mockModel = {
        id: 'model-123',
        name: 'Test Model',
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
      };

      vi.mocked(scoringService.getScoringModel).mockResolvedValueOnce(mockModel);

      const response = await request(app)
        .get('/api/v1/pipelines/pipeline-123/scoring-model')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe('Test Model');
    });
  });

  describe('POST /pipelines/:pipelineId/scoring-model', () => {
    it('should create scoring model', async () => {
      const mockModel = {
        id: 'model-123',
        name: 'New Model',
        enabled: true,
        criteria: {
          jobTitles: { target: ['CTO'], exclude: [], seniority: [] },
          companies: { industries: ['SaaS'], sizes: [], excludeIndustries: [] },
          engagement: { hasRecentPosts: true },
          completeness: { required: ['email'], bonus: [] },
        },
        weights: { jobTitle: 1.0, company: 1.0, engagement: 0.8, completeness: 0.6 },
        thresholdHigh: 80,
        thresholdMedium: 50,
      };

      vi.mocked(scoringService.upsertScoringModel).mockResolvedValueOnce(mockModel);

      const response = await request(app)
        .post('/api/v1/pipelines/pipeline-123/scoring-model')
        .send({
          name: 'New Model',
          criteria: mockModel.criteria,
          weights: mockModel.weights,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Model');
      expect(scoringService.upsertScoringModel).toHaveBeenCalledWith(
        'pipeline-123',
        expect.objectContaining({
          name: 'New Model',
        })
      );
    });
  });

  describe('POST /leads/:id/rescore', () => {
    it('should rescore a lead', async () => {
      const mockResult = {
        score: 75,
        factors: {
          jobTitle: { score: 80, reason: 'Good title match' },
          company: { score: 70, reason: 'Decent company match' },
          engagement: { score: 75, reason: 'Good engagement' },
          completeness: { score: 70, reason: 'Most fields present' },
        },
        reason: 'Lead scores well on most factors',
        classification: 'warm' as const,
      };

      vi.mocked(scoringService.scoreLead).mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/v1/leads/lead-123/rescore')
        .send({ force: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.score).toBe(75);
      expect(response.body.data.classification).toBe('warm');
      expect(scoringService.scoreLead).toHaveBeenCalledWith('lead-123', 'manual');
    });

    it('should return 404 when lead not found', async () => {
      vi.mocked(scoringService.scoreLead).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/leads/lead-123/rescore')
        .send({ force: true })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /leads/:id/score-breakdown', () => {
    it('should return score breakdown', async () => {
      const mockBreakdown = {
        score: 75,
        factors: {
          jobTitle: { score: 80, reason: 'Good title match' },
          company: { score: 70, reason: 'Decent company match' },
          engagement: { score: 75, reason: 'Good engagement' },
          completeness: { score: 70, reason: 'Most fields present' },
        },
        reason: 'Lead scores well',
        classification: 'warm' as const,
      };

      vi.mocked(scoringService.getScoreBreakdown).mockResolvedValueOnce(mockBreakdown);
      vi.mocked(scoringService.getScoreHistory).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/leads/lead-123/score-breakdown')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.score).toBe(75);
      expect(response.body.data.factors).toBeDefined();
    });

    it('should return 404 when no breakdown available', async () => {
      vi.mocked(scoringService.getScoreBreakdown).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/leads/lead-123/score-breakdown')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
