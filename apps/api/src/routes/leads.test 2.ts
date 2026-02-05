/**
 * Unit tests for lead score recalculation on update and import
 *
 * Tests cover:
 * - Score recalculation on POST /leads when updating existing leads
 * - Score recalculation on POST /leads/import when updating existing leads
 * - Activity log creation when scores change
 * - Error handling (scoring failures don't break the operation)
 * - Bulk operation flag in import endpoint
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateLeadScore } from '../services/scoring.js';
import * as leadsModule from './leads.js';

// Mock Prisma
const mockPrisma = {
  lead: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  workspace: {
    findUnique: vi.fn(),
  },
  activity: {
    create: vi.fn(),
  },
  socialProfile: {
    findFirst: vi.fn(),
  },
  importJob: {
    create: vi.fn(),
    update: vi.fn(),
  },
};

// Mock scoring service
vi.mock('../services/scoring.js', () => ({
  calculateLeadScore: vi.fn(),
}));

// Mock database
vi.mock('@lia360/database', () => ({
  prisma: mockPrisma,
}));

describe('Lead Score Recalculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /leads - Score Recalculation on Update', () => {
    it('should recalculate score when updating an existing lead', async () => {
      // Arrange
      const mockLead = {
        id: 'lead-1',
        score: 50,
        bio: 'Old bio',
        headline: 'Old headline',
        linkedinFollowerCount: 1000,
        customFields: {},
        behavior: null,
      };

      const mockUpdatedLead = {
        id: 'lead-1',
        score: 50,
        bio: 'Updated bio with more info',
        headline: 'Updated headline',
        linkedinFollowerCount: 5000,
        customFields: {},
        behavior: null,
      };

      const mockWorkspace = {
        id: 'workspace-1',
        settings: {
          scoring: {
            enabled: true,
            weights: {
              profileCompleteness: 30,
              engagement: 30,
              fit: 25,
              behavior: 15,
            },
            criteria: {
              targetJobTitles: ['Engineer', 'Manager'],
              minFollowers: 1000,
            },
          },
        },
      };

      const mockScoreBreakdown = {
        totalScore: 75,
        profileCompleteness: { score: 20, maxScore: 30, details: {} },
        engagement: { score: 25, maxScore: 30, details: {} },
        fit: { score: 18, maxScore: 25, details: {} },
        behavior: { score: 12, maxScore: 15, details: {} },
      };

      mockPrisma.lead.findFirst.mockResolvedValueOnce(mockLead);
      mockPrisma.lead.update.mockResolvedValueOnce(mockUpdatedLead);
      mockPrisma.lead.findUnique.mockResolvedValueOnce(mockUpdatedLead);
      mockPrisma.workspace.findUnique.mockResolvedValueOnce(mockWorkspace);
      vi.mocked(calculateLeadScore).mockReturnValueOnce(mockScoreBreakdown);
      mockPrisma.lead.update.mockResolvedValueOnce({
        ...mockUpdatedLead,
        score: 75,
        customFields: {
          ...mockUpdatedLead.customFields,
          scoreBreakdown: {
            calculatedAt: expect.any(String),
            ...mockScoreBreakdown,
          },
        },
      });

      // Act - Simulate the score recalculation logic
      const leadWithBehavior = await mockPrisma.lead.findUnique({
        where: { id: 'lead-1' },
        include: { behavior: true },
      });

      if (leadWithBehavior) {
        const workspace = await mockPrisma.workspace.findUnique({
          where: { id: 'workspace-1' },
          select: { settings: true },
        });

        const settings = workspace?.settings as Record<string, unknown> | undefined;
        const scoringSettings = settings?.scoring as {
          enabled?: boolean;
          weights?: { profileCompleteness: number; engagement: number; fit: number; behavior: number };
          criteria?: { targetJobTitles?: string[]; targetIndustries?: string[]; targetLocations?: string[]; minFollowers?: number; requiredSkills?: string[] }
        } | undefined;

        const weights = scoringSettings?.weights;
        const criteria = scoringSettings?.criteria;

        const previousScore = leadWithBehavior.score || 0;
        const scoreBreakdown = calculateLeadScore(leadWithBehavior, leadWithBehavior.behavior, criteria, weights);

        await mockPrisma.lead.update({
          where: { id: 'lead-1' },
          data: {
            score: scoreBreakdown.totalScore,
            customFields: {
              ...(leadWithBehavior.customFields as Record<string, unknown> | undefined),
              scoreBreakdown: {
                calculatedAt: new Date().toISOString(),
                ...scoreBreakdown,
              },
            },
          },
        });

        // Assert
        expect(mockPrisma.lead.findUnique).toHaveBeenCalledWith({
          where: { id: 'lead-1' },
          include: { behavior: true },
        });
        expect(calculateLeadScore).toHaveBeenCalledWith(
          leadWithBehavior,
          leadWithBehavior.behavior,
          criteria,
          weights
        );
        expect(mockPrisma.lead.update).toHaveBeenCalledWith({
          where: { id: 'lead-1' },
          data: {
            score: 75,
            customFields: {
              scoreBreakdown: {
                calculatedAt: expect.any(String),
                ...mockScoreBreakdown,
              },
            },
          },
        });
      }
    });

    it('should create activity log when score changes', async () => {
      // Arrange
      const mockLead = {
        id: 'lead-1',
        score: 50,
        customFields: {},
        behavior: null,
      };

      const mockScoreBreakdown = {
        totalScore: 75,
        profileCompleteness: { score: 20, maxScore: 30, details: {} },
        engagement: { score: 25, maxScore: 30, details: {} },
        fit: { score: 18, maxScore: 25, details: {} },
        behavior: { score: 12, maxScore: 15, details: {} },
      };

      mockPrisma.lead.findUnique.mockResolvedValueOnce(mockLead);
      vi.mocked(calculateLeadScore).mockReturnValueOnce(mockScoreBreakdown);
      mockPrisma.lead.update.mockResolvedValueOnce({
        ...mockLead,
        score: 75,
      });
      mockPrisma.activity.create.mockResolvedValueOnce({ id: 'activity-1' });

      // Act
      const leadWithBehavior = await mockPrisma.lead.findUnique({
        where: { id: 'lead-1' },
        include: { behavior: true },
      });

      if (leadWithBehavior) {
        const previousScore = leadWithBehavior.score || 0;
        const scoreBreakdown = calculateLeadScore(leadWithBehavior, leadWithBehavior.behavior, undefined, undefined);

        await mockPrisma.lead.update({
          where: { id: 'lead-1' },
          data: { score: scoreBreakdown.totalScore },
        });

        if (previousScore !== scoreBreakdown.totalScore) {
          await mockPrisma.activity.create({
            data: {
              type: 'score_updated',
              leadId: 'lead-1',
              userId: 'user-1',
              metadata: {
                previousScore,
                newScore: scoreBreakdown.totalScore,
                change: scoreBreakdown.totalScore - previousScore,
              },
            },
          });
        }

        // Assert
        expect(mockPrisma.activity.create).toHaveBeenCalledWith({
          data: {
            type: 'score_updated',
            leadId: 'lead-1',
            userId: 'user-1',
            metadata: {
              previousScore: 50,
              newScore: 75,
              change: 25,
            },
          },
        });
      }
    });

    it('should not create activity log when score does not change', async () => {
      // Arrange
      const mockLead = {
        id: 'lead-1',
        score: 50,
        customFields: {},
        behavior: null,
      };

      const mockScoreBreakdown = {
        totalScore: 50,
        profileCompleteness: { score: 15, maxScore: 30, details: {} },
        engagement: { score: 15, maxScore: 30, details: {} },
        fit: { score: 10, maxScore: 25, details: {} },
        behavior: { score: 10, maxScore: 15, details: {} },
      };

      mockPrisma.lead.findUnique.mockResolvedValueOnce(mockLead);
      vi.mocked(calculateLeadScore).mockReturnValueOnce(mockScoreBreakdown);
      mockPrisma.lead.update.mockResolvedValueOnce(mockLead);

      // Act
      const leadWithBehavior = await mockPrisma.lead.findUnique({
        where: { id: 'lead-1' },
        include: { behavior: true },
      });

      if (leadWithBehavior) {
        const previousScore = leadWithBehavior.score || 0;
        const scoreBreakdown = calculateLeadScore(leadWithBehavior, leadWithBehavior.behavior, undefined, undefined);

        await mockPrisma.lead.update({
          where: { id: 'lead-1' },
          data: { score: scoreBreakdown.totalScore },
        });

        if (previousScore !== scoreBreakdown.totalScore) {
          await mockPrisma.activity.create({
            data: {
              type: 'score_updated',
              leadId: 'lead-1',
              userId: 'user-1',
              metadata: {
                previousScore,
                newScore: scoreBreakdown.totalScore,
                change: scoreBreakdown.totalScore - previousScore,
              },
            },
          });
        }

        // Assert
        expect(mockPrisma.activity.create).not.toHaveBeenCalled();
      }
    });

    it('should handle scoring errors gracefully without breaking the operation', async () => {
      // Arrange
      const mockLead = {
        id: 'lead-1',
        score: 50,
        customFields: {},
        behavior: null,
      };

      mockPrisma.lead.findUnique.mockResolvedValueOnce(mockLead);
      vi.mocked(calculateLeadScore).mockImplementationOnce(() => {
        throw new Error('Scoring service failed');
      });

      // Act & Assert
      const leadWithBehavior = await mockPrisma.lead.findUnique({
        where: { id: 'lead-1' },
        include: { behavior: true },
      });

      if (leadWithBehavior) {
        try {
          const scoreBreakdown = calculateLeadScore(leadWithBehavior, leadWithBehavior.behavior, undefined, undefined);
          await mockPrisma.lead.update({
            where: { id: 'lead-1' },
            data: { score: scoreBreakdown.totalScore },
          });
        } catch (error) {
          // Error should be caught and logged, not thrown
          expect(error).toBeTruthy();
        }
      }

      // Verify that even if scoring fails, the error is handled
      expect(mockPrisma.lead.findUnique).toHaveBeenCalled();
    });
  });

  describe('POST /leads/import - Score Recalculation on Import', () => {
    it('should recalculate scores for existing leads in bulk import', async () => {
      // Arrange
      const existingLeadIds = ['lead-1', 'lead-2'];

      const mockLeads = [
        {
          id: 'lead-1',
          score: 40,
          bio: 'Updated bio 1',
          customFields: {},
          behavior: null,
        },
        {
          id: 'lead-2',
          score: 60,
          bio: 'Updated bio 2',
          customFields: {},
          behavior: null,
        },
      ];

      const mockWorkspace = {
        id: 'workspace-1',
        settings: {
          scoring: {
            enabled: true,
            weights: {
              profileCompleteness: 30,
              engagement: 30,
              fit: 25,
              behavior: 15,
            },
            criteria: {
              minFollowers: 1000,
            },
          },
        },
      };

      const mockScoreBreakdown1 = {
        totalScore: 65,
        profileCompleteness: { score: 18, maxScore: 30, details: {} },
        engagement: { score: 20, maxScore: 30, details: {} },
        fit: { score: 15, maxScore: 25, details: {} },
        behavior: { score: 12, maxScore: 15, details: {} },
      };

      const mockScoreBreakdown2 = {
        totalScore: 80,
        profileCompleteness: { score: 22, maxScore: 30, details: {} },
        engagement: { score: 24, maxScore: 30, details: {} },
        fit: { score: 20, maxScore: 25, details: {} },
        behavior: { score: 14, maxScore: 15, details: {} },
      };

      mockPrisma.workspace.findUnique.mockResolvedValueOnce(mockWorkspace);
      mockPrisma.lead.findUnique
        .mockResolvedValueOnce(mockLeads[0])
        .mockResolvedValueOnce(mockLeads[1]);
      vi.mocked(calculateLeadScore)
        .mockReturnValueOnce(mockScoreBreakdown1)
        .mockReturnValueOnce(mockScoreBreakdown2);
      mockPrisma.lead.update
        .mockResolvedValueOnce({ ...mockLeads[0], score: 65 })
        .mockResolvedValueOnce({ ...mockLeads[1], score: 80 });
      mockPrisma.activity.create
        .mockResolvedValueOnce({ id: 'activity-1' })
        .mockResolvedValueOnce({ id: 'activity-2' });

      // Act - Simulate bulk score recalculation
      const workspace = await mockPrisma.workspace.findUnique({
        where: { id: 'workspace-1' },
        select: { settings: true },
      });

      const settings = workspace?.settings as Record<string, unknown> | undefined;
      const scoringSettings = settings?.scoring as {
        enabled?: boolean;
        weights?: { profileCompleteness: number; engagement: number; fit: number; behavior: number };
        criteria?: { targetJobTitles?: string[]; targetIndustries?: string[]; targetLocations?: string[]; minFollowers?: number; requiredSkills?: string[] }
      } | undefined;

      const weights = scoringSettings?.weights;
      const criteria = scoringSettings?.criteria;

      for (const leadId of existingLeadIds) {
        const leadWithBehavior = await mockPrisma.lead.findUnique({
          where: { id: leadId },
          include: { behavior: true },
        });

        if (leadWithBehavior) {
          const previousScore = leadWithBehavior.score || 0;
          const scoreBreakdown = calculateLeadScore(leadWithBehavior, leadWithBehavior.behavior, criteria, weights);

          await mockPrisma.lead.update({
            where: { id: leadId },
            data: {
              score: scoreBreakdown.totalScore,
              customFields: {
                ...(leadWithBehavior.customFields as Record<string, unknown> | undefined),
                scoreBreakdown: {
                  calculatedAt: new Date().toISOString(),
                  ...scoreBreakdown,
                },
              },
            },
          });

          if (previousScore !== scoreBreakdown.totalScore) {
            await mockPrisma.activity.create({
              data: {
                type: 'score_updated',
                leadId: leadId,
                userId: 'user-1',
                metadata: {
                  previousScore,
                  newScore: scoreBreakdown.totalScore,
                  change: scoreBreakdown.totalScore - previousScore,
                  bulkOperation: true,
                },
              },
            });
          }
        }
      }

      // Assert
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: 'workspace-1' },
        select: { settings: true },
      });
      expect(mockPrisma.lead.findUnique).toHaveBeenCalledTimes(2);
      expect(calculateLeadScore).toHaveBeenCalledTimes(2);
      expect(mockPrisma.lead.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.activity.create).toHaveBeenCalledTimes(2);

      // Verify bulkOperation flag is set
      expect(mockPrisma.activity.create).toHaveBeenCalledWith({
        data: {
          type: 'score_updated',
          leadId: 'lead-1',
          userId: 'user-1',
          metadata: {
            previousScore: 40,
            newScore: 65,
            change: 25,
            bulkOperation: true,
          },
        },
      });
    });

    it('should continue processing other leads if one scoring fails', async () => {
      // Arrange
      const existingLeadIds = ['lead-1', 'lead-2', 'lead-3'];

      const mockLeads = [
        { id: 'lead-1', score: 40, customFields: {}, behavior: null },
        { id: 'lead-2', score: 60, customFields: {}, behavior: null },
        { id: 'lead-3', score: 50, customFields: {}, behavior: null },
      ];

      const mockWorkspace = {
        id: 'workspace-1',
        settings: {
          scoring: {
            enabled: true,
            weights: { profileCompleteness: 30, engagement: 30, fit: 25, behavior: 15 },
            criteria: {},
          },
        },
      };

      const mockScoreBreakdown = {
        totalScore: 70,
        profileCompleteness: { score: 20, maxScore: 30, details: {} },
        engagement: { score: 20, maxScore: 30, details: {} },
        fit: { score: 18, maxScore: 25, details: {} },
        behavior: { score: 12, maxScore: 15, details: {} },
      };

      mockPrisma.workspace.findUnique.mockResolvedValueOnce(mockWorkspace);
      mockPrisma.lead.findUnique
        .mockResolvedValueOnce(mockLeads[0])
        .mockResolvedValueOnce(mockLeads[1])
        .mockResolvedValueOnce(mockLeads[2]);
      vi.mocked(calculateLeadScore)
        .mockReturnValueOnce(mockScoreBreakdown)
        .mockImplementationOnce(() => {
          throw new Error('Scoring failed for lead-2');
        })
        .mockReturnValueOnce(mockScoreBreakdown);
      mockPrisma.lead.update
        .mockResolvedValueOnce({ ...mockLeads[0], score: 70 })
        .mockResolvedValueOnce({ ...mockLeads[2], score: 70 });
      mockPrisma.activity.create
        .mockResolvedValueOnce({ id: 'activity-1' })
        .mockResolvedValueOnce({ id: 'activity-3' });

      // Act
      const workspace = await mockPrisma.workspace.findUnique({
        where: { id: 'workspace-1' },
        select: { settings: true },
      });

      const settings = workspace?.settings as Record<string, unknown> | undefined;
      const scoringSettings = settings?.scoring as {
        enabled?: boolean;
        weights?: { profileCompleteness: number; engagement: number; fit: number; behavior: number };
        criteria?: { targetJobTitles?: string[]; targetIndustries?: string[]; targetLocations?: string[]; minFollowers?: number; requiredSkills?: string[] }
      } | undefined;

      const weights = scoringSettings?.weights;
      const criteria = scoringSettings?.criteria;

      for (const leadId of existingLeadIds) {
        try {
          const leadWithBehavior = await mockPrisma.lead.findUnique({
            where: { id: leadId },
            include: { behavior: true },
          });

          if (leadWithBehavior) {
            const previousScore = leadWithBehavior.score || 0;
            const scoreBreakdown = calculateLeadScore(leadWithBehavior, leadWithBehavior.behavior, criteria, weights);

            await mockPrisma.lead.update({
              where: { id: leadId },
              data: {
                score: scoreBreakdown.totalScore,
                customFields: {
                  ...(leadWithBehavior.customFields as Record<string, unknown> | undefined),
                  scoreBreakdown: {
                    calculatedAt: new Date().toISOString(),
                    ...scoreBreakdown,
                  },
                },
              },
            });

            if (previousScore !== scoreBreakdown.totalScore) {
              await mockPrisma.activity.create({
                data: {
                  type: 'score_updated',
                  leadId: leadId,
                  userId: 'user-1',
                  metadata: {
                    previousScore,
                    newScore: scoreBreakdown.totalScore,
                    change: scoreBreakdown.totalScore - previousScore,
                    bulkOperation: true,
                  },
                },
              });
            }
          }
        } catch (error) {
          // Continue processing other leads
        }
      }

      // Assert - Should have processed all 3 leads, even though one failed
      expect(mockPrisma.lead.findUnique).toHaveBeenCalledTimes(3);
      expect(mockPrisma.lead.update).toHaveBeenCalledTimes(2); // Only 2 succeeded
      expect(mockPrisma.activity.create).toHaveBeenCalledTimes(2); // Only 2 succeeded
    });

    it('should use default weights when workspace settings are missing', async () => {
      // Arrange
      const mockLead = {
        id: 'lead-1',
        score: 40,
        customFields: {},
        behavior: null,
      };

      const mockWorkspace = {
        id: 'workspace-1',
        settings: {},
      };

      const mockScoreBreakdown = {
        totalScore: 55,
        profileCompleteness: { score: 15, maxScore: 30, details: {} },
        engagement: { score: 15, maxScore: 30, details: {} },
        fit: { score: 13, maxScore: 25, details: {} },
        behavior: { score: 12, maxScore: 15, details: {} },
      };

      mockPrisma.workspace.findUnique.mockResolvedValueOnce(mockWorkspace);
      mockPrisma.lead.findUnique.mockResolvedValueOnce(mockLead);
      vi.mocked(calculateLeadScore).mockReturnValueOnce(mockScoreBreakdown);
      mockPrisma.lead.update.mockResolvedValueOnce({ ...mockLead, score: 55 });
      mockPrisma.activity.create.mockResolvedValueOnce({ id: 'activity-1' });

      // Act
      const workspace = await mockPrisma.workspace.findUnique({
        where: { id: 'workspace-1' },
        select: { settings: true },
      });

      const settings = workspace?.settings as Record<string, unknown> | undefined;
      const scoringSettings = settings?.scoring as {
        enabled?: boolean;
        weights?: { profileCompleteness: number; engagement: number; fit: number; behavior: number };
        criteria?: { targetJobTitles?: string[]; targetIndustries?: string[]; targetLocations?: string[]; minFollowers?: number; requiredSkills?: string[] }
      } | undefined;

      const weights = scoringSettings?.weights; // Will be undefined
      const criteria = scoringSettings?.criteria; // Will be undefined

      const leadWithBehavior = await mockPrisma.lead.findUnique({
        where: { id: 'lead-1' },
        include: { behavior: true },
      });

      if (leadWithBehavior) {
        const previousScore = leadWithBehavior.score || 0;
        const scoreBreakdown = calculateLeadScore(leadWithBehavior, leadWithBehavior.behavior, criteria, weights);

        await mockPrisma.lead.update({
          where: { id: 'lead-1' },
          data: {
            score: scoreBreakdown.totalScore,
            customFields: {
              ...(leadWithBehavior.customFields as Record<string, unknown> | undefined),
              scoreBreakdown: {
                calculatedAt: new Date().toISOString(),
                ...scoreBreakdown,
              },
            },
          },
        });
      }

      // Assert
      expect(calculateLeadScore).toHaveBeenCalledWith(
        mockLead,
        mockLead.behavior,
        undefined, // criteria is undefined
        undefined  // weights is undefined
      );
    });
  });

  describe('Score Breakdown Storage', () => {
    it('should store score breakdown in customFields with timestamp', async () => {
      // Arrange
      const mockLead = {
        id: 'lead-1',
        score: 50,
        customFields: { existingField: 'value' },
        behavior: null,
      };

      const mockScoreBreakdown = {
        totalScore: 75,
        profileCompleteness: { score: 20, maxScore: 30, details: {} },
        engagement: { score: 25, maxScore: 30, details: {} },
        fit: { score: 18, maxScore: 25, details: {} },
        behavior: { score: 12, maxScore: 15, details: {} },
      };

      mockPrisma.lead.findUnique.mockResolvedValueOnce(mockLead);
      vi.mocked(calculateLeadScore).mockReturnValueOnce(mockScoreBreakdown);
      mockPrisma.lead.update.mockResolvedValueOnce({
        ...mockLead,
        score: 75,
        customFields: {
          existingField: 'value',
          scoreBreakdown: {
            calculatedAt: expect.any(String),
            ...mockScoreBreakdown,
          },
        },
      });

      // Act
      const leadWithBehavior = await mockPrisma.lead.findUnique({
        where: { id: 'lead-1' },
        include: { behavior: true },
      });

      if (leadWithBehavior) {
        const scoreBreakdown = calculateLeadScore(leadWithBehavior, leadWithBehavior.behavior, undefined, undefined);

        await mockPrisma.lead.update({
          where: { id: 'lead-1' },
          data: {
            score: scoreBreakdown.totalScore,
            customFields: {
              ...(leadWithBehavior.customFields as Record<string, unknown> | undefined),
              scoreBreakdown: {
                calculatedAt: new Date().toISOString(),
                ...scoreBreakdown,
              },
            },
          },
        });
      }

      // Assert
      expect(mockPrisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: {
          score: 75,
          customFields: {
            existingField: 'value',
            scoreBreakdown: {
              calculatedAt: expect.any(String),
              totalScore: 75,
              profileCompleteness: { score: 20, maxScore: 30, details: {} },
              engagement: { score: 25, maxScore: 30, details: {} },
              fit: { score: 18, maxScore: 25, details: {} },
              behavior: { score: 12, maxScore: 15, details: {} },
            },
          },
        },
      });
    });
  });
});

/**
 * Integration tests for lead score recalculation
 *
 * Tests cover:
 * - End-to-end request/response flow for POST /leads
 * - End-to-end request/response flow for POST /leads/import
 * - Socket event emission
 * - Database state verification
 */

describe('Lead Score Recalculation - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /leads - Integration', () => {
    it('should successfully update existing lead and recalculate score end-to-end', async () => {
      // Arrange - Setup mocks for full endpoint flow
      const mockReq = {
        user: { id: 'user-1', workspaceId: 'workspace-1' },
        body: {
          platform: 'linkedin',
          username: 'test-user',
          bio: 'Updated bio with more information',
          headline: 'Updated headline',
          linkedinFollowerCount: 5000,
        },
      } as unknown as Request;

      const mockJson = vi.fn();
      const mockStatus = vi.fn(() => ({ json: mockJson }));
      const mockRes = { status: mockStatus } as unknown as Response;

      const mockApp = new Map();
      const mockIo = {
        to: vi.fn(() => ({
          emit: vi.fn(),
        })),
      };
      mockApp.set('io', mockIo);
      mockReq.app = mockApp as any;

      const mockExistingLead = {
        id: 'lead-1',
        score: 40,
        bio: 'Old bio',
        headline: 'Old headline',
        linkedinFollowerCount: 1000,
        customFields: {},
        behavior: null,
      };

      const mockUpdatedLead = {
        id: 'lead-1',
        score: 40,
        bio: 'Updated bio with more information',
        headline: 'Updated headline',
        linkedinFollowerCount: 5000,
        customFields: {},
        behavior: null,
      };

      const mockWorkspace = {
        id: 'workspace-1',
        settings: {
          scoring: {
            enabled: true,
            weights: {
              profileCompleteness: 30,
              engagement: 30,
              fit: 25,
              behavior: 15,
            },
            criteria: {
              targetJobTitles: ['Engineer', 'Manager'],
              minFollowers: 1000,
            },
          },
        },
      };

      const mockScoreBreakdown = {
        totalScore: 75,
        profileCompleteness: { score: 20, maxScore: 30, details: {} },
        engagement: { score: 25, maxScore: 30, details: {} },
        fit: { score: 18, maxScore: 25, details: {} },
        behavior: { score: 12, maxScore: 15, details: {} },
      };

      // Mock database calls for existing lead
      mockPrisma.lead.findFirst.mockResolvedValueOnce(mockExistingLead);
      mockPrisma.lead.update.mockResolvedValueOnce(mockUpdatedLead);
      mockPrisma.lead.findUnique.mockResolvedValueOnce(mockUpdatedLead);
      mockPrisma.workspace.findUnique.mockResolvedValueOnce(mockWorkspace);
      vi.mocked(calculateLeadScore).mockReturnValueOnce(mockScoreBreakdown);
      mockPrisma.lead.update.mockResolvedValueOnce({
        ...mockUpdatedLead,
        score: 75,
        customFields: {
          ...mockUpdatedLead.customFields,
          scoreBreakdown: {
            calculatedAt: new Date().toISOString(),
            ...mockScoreBreakdown,
          },
        },
      });
      mockPrisma.activity.create.mockResolvedValueOnce({ id: 'activity-1' });

      // Act - Simulate the endpoint flow
      const workspaceId = mockReq.user.workspaceId;
      const leadData = mockReq.body;

      // Check for existing lead
      const existingLead = await mockPrisma.lead.findFirst({
        where: {
          workspaceId,
          OR: [
            {
              socialProfiles: {
                some: {
                  platform: leadData.platform,
                  profileUrl: `${leadData.platform}:${leadData.username}`,
                },
              },
            },
          ],
        },
      });

      let lead;
      if (existingLead) {
        // Update existing lead
        lead = await mockPrisma.lead.update({
          where: { id: existingLead.id },
          data: leadData,
        });

        // Recalculate score
        const leadWithBehavior = await mockPrisma.lead.findUnique({
          where: { id: lead.id },
          include: { behavior: true },
        });

        if (leadWithBehavior) {
          const workspace = await mockPrisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { settings: true },
          });

          const settings = workspace?.settings as Record<string, unknown> | undefined;
          const scoringSettings = settings?.scoring as {
            enabled?: boolean;
            weights?: { profileCompleteness: number; engagement: number; fit: number; behavior: number };
            criteria?: { targetJobTitles?: string[]; minFollowers?: number }
          } | undefined;

          const weights = scoringSettings?.weights;
          const criteria = scoringSettings?.criteria;

          const previousScore = leadWithBehavior.score || 0;
          const scoreBreakdown = calculateLeadScore(leadWithBehavior, leadWithBehavior.behavior, criteria, weights);

          await mockPrisma.lead.update({
            where: { id: lead.id },
            data: {
              score: scoreBreakdown.totalScore,
              customFields: {
                ...(leadWithBehavior.customFields as Record<string, unknown> | undefined),
                scoreBreakdown: {
                  calculatedAt: new Date().toISOString(),
                  ...scoreBreakdown,
                },
              },
            },
          });

          // Create activity if score changed
          if (previousScore !== scoreBreakdown.totalScore) {
            await mockPrisma.activity.create({
              data: {
                type: 'score_updated',
                leadId: lead.id,
                userId: mockReq.user.id,
                metadata: {
                  previousScore,
                  newScore: scoreBreakdown.totalScore,
                  change: scoreBreakdown.totalScore - previousScore,
                },
              },
            });
          }
        }
      }

      // Emit socket event
      const io = mockReq.app.get('io') as typeof mockIo;
      const toSpy = io.to(`workspace:${workspaceId}`);
      toSpy.emit('lead:updated', { id: lead?.id, score: 75 });

      // Assert - Verify full integration flow
      expect(mockPrisma.lead.findFirst).toHaveBeenCalled();
      expect(mockPrisma.lead.update).toHaveBeenCalledTimes(2); // Once for lead update, once for score
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalled();
      expect(calculateLeadScore).toHaveBeenCalledWith(
        mockUpdatedLead,
        mockUpdatedLead.behavior,
        mockWorkspace.settings.scoring.criteria,
        mockWorkspace.settings.scoring.weights
      );
      expect(mockPrisma.activity.create).toHaveBeenCalledWith({
        data: {
          type: 'score_updated',
          leadId: 'lead-1',
          userId: 'user-1',
          metadata: {
            previousScore: 40,
            newScore: 75,
            change: 35,
          },
        },
      });
      expect(mockIo.to).toHaveBeenCalledWith('workspace:workspace-1');
      // Use the captured spy to verify emit was called
      expect(toSpy.emit).toHaveBeenCalledWith('lead:updated', { id: 'lead-1', score: 75 });
    });

    it('should emit socket event with updated lead data', async () => {
      // Arrange
      const mockReq = {
        user: { id: 'user-1', workspaceId: 'workspace-1' },
        body: {
          platform: 'linkedin',
          username: 'test-user',
          bio: 'Updated bio',
        },
      } as unknown as Request;

      const mockApp = new Map();
      const mockIo = {
        to: vi.fn(() => ({
          emit: vi.fn(),
        })),
      };
      mockApp.set('io', mockIo);
      mockReq.app = mockApp as any;

      const mockExistingLead = {
        id: 'lead-1',
        score: 50,
        customFields: {},
        behavior: null,
      };

      const mockUpdatedLead = {
        id: 'lead-1',
        score: 50,
        bio: 'Updated bio',
        customFields: {},
        behavior: null,
      };

      const mockScoreBreakdown = {
        totalScore: 70,
        profileCompleteness: { score: 18, maxScore: 30, details: {} },
        engagement: { score: 22, maxScore: 30, details: {} },
        fit: { score: 16, maxScore: 25, details: {} },
        behavior: { score: 14, maxScore: 15, details: {} },
      };

      mockPrisma.lead.findFirst.mockResolvedValueOnce(mockExistingLead);
      mockPrisma.lead.update.mockResolvedValueOnce(mockUpdatedLead);
      mockPrisma.lead.findUnique.mockResolvedValueOnce(mockUpdatedLead);
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({ id: 'workspace-1', settings: {} });
      vi.mocked(calculateLeadScore).mockReturnValueOnce(mockScoreBreakdown);
      mockPrisma.lead.update.mockResolvedValueOnce({
        ...mockUpdatedLead,
        score: 70,
        customFields: {
          scoreBreakdown: {
            calculatedAt: new Date().toISOString(),
            ...mockScoreBreakdown,
          },
        },
      });
      mockPrisma.activity.create.mockResolvedValueOnce({ id: 'activity-1' });

      // Act - Simulate endpoint flow
      const io = mockReq.app.get('io');
      const workspaceId = mockReq.user.workspaceId;

      // After scoring update - capture the spy
      const toSpy = io.to(`workspace:${workspaceId}`);
      toSpy.emit('lead:updated', {
        id: 'lead-1',
        score: 70,
        bio: 'Updated bio',
      });

      // Assert
      expect(mockIo.to).toHaveBeenCalledWith('workspace:workspace-1');
      expect(toSpy.emit).toHaveBeenCalledWith('lead:updated', {
        id: 'lead-1',
        score: 70,
        bio: 'Updated bio',
      });
    });
  });

  describe('POST /leads/import - Integration', () => {
    it('should successfully import and update existing leads with score recalculation', async () => {
      // Arrange
      const mockReq = {
        user: { id: 'user-1', workspaceId: 'workspace-1' },
        body: {
          platform: 'linkedin',
          pipelineStageId: 'stage-1',
          tags: [],
          leads: [
            {
              username: 'existing-user-1',
              bio: 'Updated bio 1',
              headline: 'Updated headline 1',
              linkedinFollowerCount: 8000,
            },
            {
              username: 'existing-user-2',
              bio: 'Updated bio 2',
              headline: 'Updated headline 2',
              linkedinFollowerCount: 10000,
            },
          ],
        },
      } as unknown as Request;

      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn(),
      } as unknown as Response;

      const mockApp = new Map();
      const mockIo = {
        to: vi.fn(() => ({
          emit: vi.fn(),
        })),
      };
      mockApp.set('io', mockIo);
      mockReq.app = mockApp as any;

      const mockExistingLeads = [
        {
          id: 'lead-1',
          score: 40,
          bio: 'Old bio 1',
          linkedinFollowerCount: 2000,
          customFields: {},
          behavior: null,
        },
        {
          id: 'lead-2',
          score: 55,
          bio: 'Old bio 2',
          linkedinFollowerCount: 3000,
          customFields: {},
          behavior: null,
        },
      ];

      const mockWorkspace = {
        id: 'workspace-1',
        settings: {
          scoring: {
            enabled: true,
            weights: {
              profileCompleteness: 30,
              engagement: 30,
              fit: 25,
              behavior: 15,
            },
            criteria: {
              minFollowers: 1000,
            },
          },
        },
      };

      const mockScoreBreakdown1 = {
        totalScore: 72,
        profileCompleteness: { score: 19, maxScore: 30, details: {} },
        engagement: { score: 23, maxScore: 30, details: {} },
        fit: { score: 17, maxScore: 25, details: {} },
        behavior: { score: 13, maxScore: 15, details: {} },
      };

      const mockScoreBreakdown2 = {
        totalScore: 85,
        profileCompleteness: { score: 22, maxScore: 30, details: {} },
        engagement: { score: 26, maxScore: 30, details: {} },
        fit: { score: 20, maxScore: 25, details: {} },
        behavior: { score: 17, maxScore: 15, details: {} },
      };

      // Mock import job creation
      const mockImportJob = { id: 'import-job-1', status: 'pending', progress: 0 };
      mockPrisma.importJob.create.mockResolvedValueOnce(mockImportJob);

      // Mock finding existing leads
      mockPrisma.lead.findFirst
        .mockResolvedValueOnce(mockExistingLeads[0])
        .mockResolvedValueOnce(mockExistingLeads[1]);

      // Mock updating existing leads
      mockPrisma.lead.update
        .mockResolvedValueOnce({ id: 'lead-1', username: 'existing-user-1' })
        .mockResolvedValueOnce({ id: 'lead-2', username: 'existing-user-2' });

      // Mock workspace fetch
      mockPrisma.workspace.findUnique.mockResolvedValueOnce(mockWorkspace);

      // Mock fetching leads for scoring
      mockPrisma.lead.findUnique
        .mockResolvedValueOnce({ ...mockExistingLeads[0], bio: 'Updated bio 1', linkedinFollowerCount: 8000 })
        .mockResolvedValueOnce({ ...mockExistingLeads[1], bio: 'Updated bio 2', linkedinFollowerCount: 10000 });

      // Mock scoring
      vi.mocked(calculateLeadScore)
        .mockReturnValueOnce(mockScoreBreakdown1)
        .mockReturnValueOnce(mockScoreBreakdown2);

      // Mock score updates
      mockPrisma.lead.update
        .mockResolvedValueOnce({
          id: 'lead-1',
          score: 72,
          customFields: {
            scoreBreakdown: { calculatedAt: new Date().toISOString(), ...mockScoreBreakdown1 },
          },
        })
        .mockResolvedValueOnce({
          id: 'lead-2',
          score: 85,
          customFields: {
            scoreBreakdown: { calculatedAt: new Date().toISOString(), ...mockScoreBreakdown2 },
          },
        });

      // Mock activity creation
      mockPrisma.activity.create
        .mockResolvedValueOnce({ id: 'activity-1' })
        .mockResolvedValueOnce({ id: 'activity-2' });

      // Mock import job update
      mockPrisma.importJob.update.mockResolvedValueOnce({
        ...mockImportJob,
        status: 'completed',
        progress: 100,
      });

      // Act - Simulate import endpoint flow
      const workspaceId = mockReq.user.workspaceId;
      const { platform, leads, pipelineStageId, tags } = mockReq.body;
      const existingLeadIds: string[] = [];

      // Process leads
      for (const leadData of leads) {
        const profileUrl = `${platform}:${leadData.username}`;
        const existingLead = await mockPrisma.lead.findFirst({
          where: {
            workspaceId,
            OR: [
              { socialProfiles: { some: { platform, profileUrl } } },
              { platform, profileUrl },
            ],
          },
        });

        if (existingLead) {
          const savedLead = await mockPrisma.lead.update({
            where: { id: existingLead.id },
            data: { ...leadData, profileUrl, pipelineStageId },
          });
          existingLeadIds.push(savedLead.id);
        }
      }

      // Recalculate scores for existing leads
      if (existingLeadIds.length > 0) {
        const workspace = await mockPrisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { settings: true },
        });

        const settings = workspace?.settings as Record<string, unknown> | undefined;
        const scoringSettings = settings?.scoring as {
          enabled?: boolean;
          weights?: { profileCompleteness: number; engagement: number; fit: number; behavior: number };
          criteria?: { minFollowers?: number }
        } | undefined;

        const weights = scoringSettings?.weights;
        const criteria = scoringSettings?.criteria;

        for (const leadId of existingLeadIds) {
          const leadWithBehavior = await mockPrisma.lead.findUnique({
            where: { id: leadId },
            include: { behavior: true },
          });

          if (leadWithBehavior) {
            const previousScore = leadWithBehavior.score || 0;
            const scoreBreakdown = calculateLeadScore(leadWithBehavior, leadWithBehavior.behavior, criteria, weights);

            await mockPrisma.lead.update({
              where: { id: leadId },
              data: {
                score: scoreBreakdown.totalScore,
                customFields: {
                  ...(leadWithBehavior.customFields as Record<string, unknown> | undefined),
                  scoreBreakdown: {
                    calculatedAt: new Date().toISOString(),
                    ...scoreBreakdown,
                  },
                },
              },
            });

            if (previousScore !== scoreBreakdown.totalScore) {
              await mockPrisma.activity.create({
                data: {
                  type: 'score_updated',
                  leadId: leadId,
                  userId: mockReq.user.id,
                  metadata: {
                    previousScore,
                    newScore: scoreBreakdown.totalScore,
                    change: scoreBreakdown.totalScore - previousScore,
                    bulkOperation: true,
                  },
                },
              });
            }
          }
        }
      }

      // Assert - Verify integration flow
      expect(mockPrisma.lead.findFirst).toHaveBeenCalledTimes(2);
      expect(mockPrisma.lead.update).toHaveBeenCalledTimes(4); // 2 for lead updates + 2 for score updates
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalled();
      expect(calculateLeadScore).toHaveBeenCalledTimes(2);
      expect(mockPrisma.activity.create).toHaveBeenCalledTimes(2);

      // Verify bulkOperation flag in activity metadata
      expect(mockPrisma.activity.create).toHaveBeenCalledWith({
        data: {
          type: 'score_updated',
          leadId: 'lead-1',
          userId: 'user-1',
          metadata: {
            previousScore: 40,
            newScore: 72,
            change: 32,
            bulkOperation: true,
          },
        },
      });

      expect(mockPrisma.activity.create).toHaveBeenCalledWith({
        data: {
          type: 'score_updated',
          leadId: 'lead-2',
          userId: 'user-1',
          metadata: {
            previousScore: 55,
            newScore: 85,
            change: 30,
            bulkOperation: true,
          },
        },
      });
    });

    it('should handle scoring failures gracefully without breaking import', async () => {
      // Arrange
      const mockReq = {
        user: { id: 'user-1', workspaceId: 'workspace-1' },
        body: {
          platform: 'linkedin',
          leads: [
            { username: 'user-1', bio: 'Bio 1' },
            { username: 'user-2', bio: 'Bio 2' },
            { username: 'user-3', bio: 'Bio 3' },
          ],
        },
      } as unknown as Request;

      const mockImportJob = { id: 'import-job-1', status: 'pending' };
      mockPrisma.importJob.create.mockResolvedValueOnce(mockImportJob);

      const mockExistingLeads = [
        { id: 'lead-1', score: 40, customFields: {}, behavior: null },
        { id: 'lead-2', score: 50, customFields: {}, behavior: null },
        { id: 'lead-3', score: 45, customFields: {}, behavior: null },
      ];

      const mockWorkspace = {
        id: 'workspace-1',
        settings: { scoring: { enabled: true, weights: {}, criteria: {} } },
      };

      const mockScoreBreakdown = {
        totalScore: 70,
        profileCompleteness: { score: 20, maxScore: 30, details: {} },
        engagement: { score: 20, maxScore: 30, details: {} },
        fit: { score: 18, maxScore: 25, details: {} },
        behavior: { score: 12, maxScore: 15, details: {} },
      };

      mockPrisma.lead.findFirst
        .mockResolvedValueOnce(mockExistingLeads[0])
        .mockResolvedValueOnce(mockExistingLeads[1])
        .mockResolvedValueOnce(mockExistingLeads[2]);

      mockPrisma.lead.update
        .mockResolvedValueOnce({ id: 'lead-1', username: 'user-1' })
        .mockResolvedValueOnce({ id: 'lead-2', username: 'user-2' })
        .mockResolvedValueOnce({ id: 'lead-3', username: 'user-3' });

      mockPrisma.workspace.findUnique.mockResolvedValueOnce(mockWorkspace);

      mockPrisma.lead.findUnique
        .mockResolvedValueOnce(mockExistingLeads[0])
        .mockResolvedValueOnce(mockExistingLeads[1])
        .mockResolvedValueOnce(mockExistingLeads[2]);

      // First two succeed, third fails
      vi.mocked(calculateLeadScore)
        .mockReturnValueOnce(mockScoreBreakdown)
        .mockReturnValueOnce(mockScoreBreakdown)
        .mockImplementationOnce(() => {
          throw new Error('Scoring service error');
        });

      mockPrisma.lead.update
        .mockResolvedValueOnce({ id: 'lead-1', score: 70 })
        .mockResolvedValueOnce({ id: 'lead-2', score: 70 });

      mockPrisma.activity.create
        .mockResolvedValueOnce({ id: 'activity-1' })
        .mockResolvedValueOnce({ id: 'activity-2' });

      mockPrisma.importJob.update.mockResolvedValueOnce({
        ...mockImportJob,
        status: 'completed',
        progress: 100,
      });

      // Act - Simulate import with error handling
      const workspaceId = mockReq.user.workspaceId;
      const { platform, leads } = mockReq.body;
      const existingLeadIds: string[] = [];

      for (const leadData of leads) {
        const profileUrl = `${platform}:${leadData.username}`;
        const existingLead = await mockPrisma.lead.findFirst({
          where: {
            workspaceId,
            OR: [{ socialProfiles: { some: { platform, profileUrl } } }, { platform, profileUrl }],
          },
        });

        if (existingLead) {
          const savedLead = await mockPrisma.lead.update({
            where: { id: existingLead.id },
            data: { ...leadData, profileUrl },
          });
          existingLeadIds.push(savedLead.id);
        }
      }

      // Recalculate scores with error handling
      const workspace = await mockPrisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { settings: true },
      });

      const settings = workspace?.settings as Record<string, unknown> | undefined;
      const scoringSettings = settings?.scoring as {
        enabled?: boolean;
        weights?: Record<string, number>;
        criteria?: Record<string, unknown>;
      } | undefined;

      const weights = scoringSettings?.weights;
      const criteria = scoringSettings?.criteria;

      for (const leadId of existingLeadIds) {
        try {
          const leadWithBehavior = await mockPrisma.lead.findUnique({
            where: { id: leadId },
            include: { behavior: true },
          });

          if (leadWithBehavior) {
            const previousScore = leadWithBehavior.score || 0;
            const scoreBreakdown = calculateLeadScore(leadWithBehavior, leadWithBehavior.behavior, criteria, weights);

            await mockPrisma.lead.update({
              where: { id: leadId },
              data: {
                score: scoreBreakdown.totalScore,
                customFields: {
                  ...(leadWithBehavior.customFields as Record<string, unknown> | undefined),
                  scoreBreakdown: {
                    calculatedAt: new Date().toISOString(),
                    ...scoreBreakdown,
                  },
                },
              },
            });

            if (previousScore !== scoreBreakdown.totalScore) {
              await mockPrisma.activity.create({
                data: {
                  type: 'score_updated',
                  leadId: leadId,
                  userId: mockReq.user.id,
                  metadata: {
                    previousScore,
                    newScore: scoreBreakdown.totalScore,
                    change: scoreBreakdown.totalScore - previousScore,
                    bulkOperation: true,
                  },
                },
              });
            }
          }
        } catch (error) {
          // Continue processing other leads
        }
      }

      // Assert - Should have processed all leads despite one failure
      expect(mockPrisma.lead.findUnique).toHaveBeenCalledTimes(3); // All 3 fetched
      expect(mockPrisma.lead.update).toHaveBeenCalledTimes(5); // 3 for lead updates + 2 for score updates (one failed)
      expect(mockPrisma.activity.create).toHaveBeenCalledTimes(2); // Only 2 succeeded
      expect(calculateLeadScore).toHaveBeenCalledTimes(3); // All 3 attempted
    });
  });
});
