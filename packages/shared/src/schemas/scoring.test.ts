import { describe, it, expect } from 'vitest';
import {
    createScoringConfigSchema,
    updateScoringConfigSchema,
    calculateLeadScoreSchema,
    batchCalculateScoresSchema,
    leadScoreBreakdownSchema,
    leadScoreResponseSchema,
    batchScoreResponseSchema,
    companySizeSchema,
} from './scoring';

describe('Scoring Configuration Validation', () => {
    describe('createScoringConfigSchema', () => {
        describe('Weight Validation', () => {
            it('accepts valid scoring configuration with weights summing to 100', () => {
                const result = createScoringConfigSchema.safeParse({
                    jobTitleWeight: 25,
                    companyWeight: 20,
                    profileCompletenessWeight: 15,
                    activityWeight: 20,
                    enrichmentWeight: 20,
                });

                expect(result.success).toBe(true);
            });

            it('rejects configuration when weights do not sum to 100', () => {
                const result = createScoringConfigSchema.safeParse({
                    jobTitleWeight: 30,
                    companyWeight: 30,
                    profileCompletenessWeight: 20,
                    activityWeight: 10,
                    enrichmentWeight: 10, // Sum = 100, should pass
                });

                expect(result.success).toBe(true);
            });

            it('rejects configuration when weights sum to less than 100', () => {
                const result = createScoringConfigSchema.safeParse({
                    jobTitleWeight: 20,
                    companyWeight: 20,
                    profileCompletenessWeight: 15,
                    activityWeight: 20,
                    enrichmentWeight: 20, // Sum = 95
                });

                expect(result.success).toBe(false);
                if (!result.success) {
                    const errorMessages = result.error.errors.map(e => e.message);
                    expect(errorMessages).toContain('Scoring weights must sum to exactly 100');
                }
            });

            it('rejects configuration when weights sum to more than 100', () => {
                const result = createScoringConfigSchema.safeParse({
                    jobTitleWeight: 30,
                    companyWeight: 30,
                    profileCompletenessWeight: 20,
                    activityWeight: 20,
                    enrichmentWeight: 20, // Sum = 120
                });

                expect(result.success).toBe(false);
                if (!result.success) {
                    const errorMessages = result.error.errors.map(e => e.message);
                    expect(errorMessages).toContain('Scoring weights must sum to exactly 100');
                }
            });

            it('rejects weights outside valid range (negative)', () => {
                const result = createScoringConfigSchema.safeParse({
                    jobTitleWeight: -10,
                    companyWeight: 30,
                    profileCompletenessWeight: 30,
                    activityWeight: 30,
                    enrichmentWeight: 20,
                });

                expect(result.success).toBe(false);
            });

            it('rejects weights outside valid range (over 100)', () => {
                const result = createScoringConfigSchema.safeParse({
                    jobTitleWeight: 150,
                    companyWeight: 0,
                    profileCompletenessWeight: 0,
                    activityWeight: 0,
                    enrichmentWeight: 0,
                });

                expect(result.success).toBe(false);
            });

            it('rejects non-integer weights', () => {
                const result = createScoringConfigSchema.safeParse({
                    jobTitleWeight: 25.5,
                    companyWeight: 20,
                    profileCompletenessWeight: 15,
                    activityWeight: 20,
                    enrichmentWeight: 19.5,
                });

                expect(result.success).toBe(false);
            });
        });

        describe('Target Criteria Validation', () => {
            it('accepts valid target job titles array', () => {
                const result = createScoringConfigSchema.safeParse({
                    jobTitleWeight: 25,
                    companyWeight: 20,
                    profileCompletenessWeight: 15,
                    activityWeight: 20,
                    enrichmentWeight: 20,
                    targetJobTitles: ['CEO', 'CTO', 'VP of Engineering'],
                });

                expect(result.success).toBe(true);
            });

            it('accepts valid company sizes', () => {
                const result = createScoringConfigSchema.safeParse({
                    jobTitleWeight: 25,
                    companyWeight: 20,
                    profileCompletenessWeight: 15,
                    activityWeight: 20,
                    enrichmentWeight: 20,
                    targetCompanySizes: ['SIZE_1_10', 'SIZE_11_50', 'SIZE_51_200'],
                });

                expect(result.success).toBe(true);
            });

            it('rejects invalid company size', () => {
                const result = createScoringConfigSchema.safeParse({
                    jobTitleWeight: 25,
                    companyWeight: 20,
                    profileCompletenessWeight: 15,
                    activityWeight: 20,
                    enrichmentWeight: 20,
                    targetCompanySizes: ['INVALID_SIZE'],
                });

                expect(result.success).toBe(false);
            });

            it('accepts valid target industries', () => {
                const result = createScoringConfigSchema.safeParse({
                    jobTitleWeight: 25,
                    companyWeight: 20,
                    profileCompletenessWeight: 15,
                    activityWeight: 20,
                    enrichmentWeight: 20,
                    targetIndustries: ['Technology', 'Finance', 'Healthcare'],
                });

                expect(result.success).toBe(true);
            });

            it('accepts valid min profile completeness', () => {
                const result = createScoringConfigSchema.safeParse({
                    jobTitleWeight: 25,
                    companyWeight: 20,
                    profileCompletenessWeight: 15,
                    activityWeight: 20,
                    enrichmentWeight: 20,
                    minProfileCompleteness: 75,
                });

                expect(result.success).toBe(true);
            });

            it('rejects min profile completeness outside range', () => {
                const result = createScoringConfigSchema.safeParse({
                    jobTitleWeight: 25,
                    companyWeight: 20,
                    profileCompletenessWeight: 15,
                    activityWeight: 20,
                    enrichmentWeight: 20,
                    minProfileCompleteness: 150,
                });

                expect(result.success).toBe(false);
            });
        });

        describe('Auto-Score Settings', () => {
            it('accepts valid auto-score settings', () => {
                const result = createScoringConfigSchema.safeParse({
                    jobTitleWeight: 25,
                    companyWeight: 20,
                    profileCompletenessWeight: 15,
                    activityWeight: 20,
                    enrichmentWeight: 20,
                    autoScoreOnImport: true,
                    autoScoreOnUpdate: false,
                });

                expect(result.success).toBe(true);
            });
        });

        describe('Default Values', () => {
            it('applies default values for optional fields', () => {
                const result = createScoringConfigSchema.safeParse({
                    jobTitleWeight: 25,
                    companyWeight: 20,
                    profileCompletenessWeight: 15,
                    activityWeight: 20,
                    enrichmentWeight: 20,
                });

                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.targetJobTitles).toEqual([]);
                    expect(result.data.targetCompanySizes).toEqual([]);
                    expect(result.data.targetIndustries).toEqual([]);
                    expect(result.data.minProfileCompleteness).toBe(50);
                    expect(result.data.autoScoreOnImport).toBe(true);
                    expect(result.data.autoScoreOnUpdate).toBe(true);
                }
            });
        });
    });

    describe('updateScoringConfigSchema', () => {
        it('accepts partial updates with single field', () => {
            const result = updateScoringConfigSchema.safeParse({
                jobTitleWeight: 30,
            });

            expect(result.success).toBe(true);
        });

        it('accepts partial updates with multiple fields', () => {
            const result = updateScoringConfigSchema.safeParse({
                jobTitleWeight: 30,
                companyWeight: 25,
                minProfileCompleteness: 75,
            });

            expect(result.success).toBe(true);
        });

        it('accepts update with all weights summing to 100', () => {
            const result = updateScoringConfigSchema.safeParse({
                jobTitleWeight: 30,
                companyWeight: 25,
                profileCompletenessWeight: 15,
                activityWeight: 15,
                enrichmentWeight: 15,
            });

            expect(result.success).toBe(true);
        });

        it('rejects update with all weights not summing to 100', () => {
            const result = updateScoringConfigSchema.safeParse({
                jobTitleWeight: 30,
                companyWeight: 30,
                profileCompletenessWeight: 30,
                activityWeight: 30,
                enrichmentWeight: 30, // Sum = 150
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                const errorMessages = result.error.errors.map(e => e.message);
                expect(errorMessages).toContain('If updating all weights, they must sum to exactly 100');
            }
        });

        it('accepts updating target criteria arrays', () => {
            const result = updateScoringConfigSchema.safeParse({
                targetJobTitles: ['CEO', 'Founder'],
                targetIndustries: ['SaaS', 'FinTech'],
            });

            expect(result.success).toBe(true);
        });

        it('rejects invalid company size in update', () => {
            const result = updateScoringConfigSchema.safeParse({
                targetCompanySizes: ['INVALID_SIZE'],
            });

            expect(result.success).toBe(false);
        });

        it('accepts updating boolean settings', () => {
            const result = updateScoringConfigSchema.safeParse({
                autoScoreOnImport: false,
                autoScoreOnUpdate: false,
            });

            expect(result.success).toBe(true);
        });
    });
});

describe('Scoring Request Validation', () => {
    describe('calculateLeadScoreSchema', () => {
        it('accepts valid lead score calculation request', () => {
            const result = calculateLeadScoreSchema.safeParse({
                leadId: 'lead-123',
            });

            expect(result.success).toBe(true);
        });

        it('rejects request without leadId', () => {
            const result = calculateLeadScoreSchema.safeParse({
                forceRecalculate: true,
            });

            expect(result.success).toBe(false);
        });

        it('rejects request with empty leadId', () => {
            const result = calculateLeadScoreSchema.safeParse({
                leadId: '',
            });

            expect(result.success).toBe(false);
        });

        it('accepts request with forceRecalculate flag', () => {
            const result = calculateLeadScoreSchema.safeParse({
                leadId: 'lead-123',
                forceRecalculate: true,
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.forceRecalculate).toBe(true);
            }
        });

        it('applies default value for forceRecalculate', () => {
            const result = calculateLeadScoreSchema.safeParse({
                leadId: 'lead-123',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.forceRecalculate).toBe(false);
            }
        });
    });

    describe('batchCalculateScoresSchema', () => {
        it('accepts valid batch score calculation', () => {
            const result = batchCalculateScoresSchema.safeParse({
                leadIds: ['lead-1', 'lead-2', 'lead-3'],
            });

            expect(result.success).toBe(true);
        });

        it('rejects empty leadIds array', () => {
            const result = batchCalculateScoresSchema.safeParse({
                leadIds: [],
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                const errorMessages = result.error.errors.map(e => e.message);
                expect(errorMessages).toContain('At least one lead ID is required');
            }
        });

        it('rejects leadIds array exceeding maximum', () => {
            const leadIds = Array.from({ length: 101 }, (_, i) => `lead-${i}`);
            const result = batchCalculateScoresSchema.safeParse({
                leadIds,
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                const errorMessages = result.error.errors.map(e => e.message);
                expect(errorMessages).toContain('Maximum 100 leads per batch');
            }
        });

        it('accepts batch with exactly 100 leads', () => {
            const leadIds = Array.from({ length: 100 }, (_, i) => `lead-${i}`);
            const result = batchCalculateScoresSchema.safeParse({
                leadIds,
            });

            expect(result.success).toBe(true);
        });

        it('rejects array with empty strings', () => {
            const result = batchCalculateScoresSchema.safeParse({
                leadIds: ['lead-1', '', 'lead-3'],
            });

            expect(result.success).toBe(false);
        });

        it('accepts batch with forceRecalculate flag', () => {
            const result = batchCalculateScoresSchema.safeParse({
                leadIds: ['lead-1', 'lead-2'],
                forceRecalculate: true,
            });

            expect(result.success).toBe(true);
        });
    });
});

describe('Scoring Response Validation', () => {
    describe('leadScoreBreakdownSchema', () => {
        it('accepts valid score breakdown', () => {
            const result = leadScoreBreakdownSchema.safeParse({
                jobTitleScore: 80,
                companyScore: 75,
                profileCompletenessScore: 90,
                activityScore: 60,
                enrichmentScore: 85,
                finalScore: 78,
            });

            expect(result.success).toBe(true);
        });

        it('accepts breakdown with explanation', () => {
            const result = leadScoreBreakdownSchema.safeParse({
                jobTitleScore: 80,
                companyScore: 75,
                profileCompletenessScore: 90,
                activityScore: 60,
                enrichmentScore: 85,
                finalScore: 78,
                explanation: 'Strong match for job title and company',
            });

            expect(result.success).toBe(true);
        });

        it('rejects scores outside valid range (negative)', () => {
            const result = leadScoreBreakdownSchema.safeParse({
                jobTitleScore: -10,
                companyScore: 75,
                profileCompletenessScore: 90,
                activityScore: 60,
                enrichmentScore: 85,
                finalScore: 78,
            });

            expect(result.success).toBe(false);
        });

        it('rejects scores outside valid range (over 100)', () => {
            const result = leadScoreBreakdownSchema.safeParse({
                jobTitleScore: 150,
                companyScore: 75,
                profileCompletenessScore: 90,
                activityScore: 60,
                enrichmentScore: 85,
                finalScore: 78,
            });

            expect(result.success).toBe(false);
        });

        it('accepts all zero scores', () => {
            const result = leadScoreBreakdownSchema.safeParse({
                jobTitleScore: 0,
                companyScore: 0,
                profileCompletenessScore: 0,
                activityScore: 0,
                enrichmentScore: 0,
                finalScore: 0,
            });

            expect(result.success).toBe(true);
        });

        it('accepts all maximum scores', () => {
            const result = leadScoreBreakdownSchema.safeParse({
                jobTitleScore: 100,
                companyScore: 100,
                profileCompletenessScore: 100,
                activityScore: 100,
                enrichmentScore: 100,
                finalScore: 100,
            });

            expect(result.success).toBe(true);
        });
    });

    describe('leadScoreResponseSchema', () => {
        it('accepts valid lead score response', () => {
            const result = leadScoreResponseSchema.safeParse({
                leadId: 'lead-123',
                score: 85,
                breakdown: {
                    jobTitleScore: 90,
                    companyScore: 80,
                    profileCompletenessScore: 85,
                    activityScore: 70,
                    enrichmentScore: 90,
                    finalScore: 85,
                },
                scoredAt: '2024-01-15T10:30:00Z',
            });

            expect(result.success).toBe(true);
        });

        it('accepts response without breakdown', () => {
            const result = leadScoreResponseSchema.safeParse({
                leadId: 'lead-123',
                score: 85,
            });

            expect(result.success).toBe(true);
        });

        it('accepts response without scoredAt', () => {
            const result = leadScoreResponseSchema.safeParse({
                leadId: 'lead-123',
                score: 85,
                breakdown: {
                    jobTitleScore: 90,
                    companyScore: 80,
                    profileCompletenessScore: 85,
                    activityScore: 70,
                    enrichmentScore: 90,
                    finalScore: 85,
                },
            });

            expect(result.success).toBe(true);
        });

        it('rejects invalid score range', () => {
            const result = leadScoreResponseSchema.safeParse({
                leadId: 'lead-123',
                score: 150,
            });

            expect(result.success).toBe(false);
        });

        it('rejects invalid datetime format', () => {
            const result = leadScoreResponseSchema.safeParse({
                leadId: 'lead-123',
                score: 85,
                scoredAt: 'invalid-date',
            });

            expect(result.success).toBe(false);
        });
    });

    describe('batchScoreResponseSchema', () => {
        it('accepts valid batch score response', () => {
            const result = batchScoreResponseSchema.safeParse({
                results: [
                    {
                        leadId: 'lead-1',
                        score: 85,
                    },
                    {
                        leadId: 'lead-2',
                        score: 72,
                    },
                ],
                totalProcessed: 2,
                totalFailed: 0,
            });

            expect(result.success).toBe(true);
        });

        it('accepts batch response with errors', () => {
            const result = batchScoreResponseSchema.safeParse({
                results: [
                    {
                        leadId: 'lead-1',
                        score: 85,
                    },
                ],
                totalProcessed: 2,
                totalFailed: 1,
                errors: [
                    {
                        leadId: 'lead-2',
                        error: 'Lead not found',
                    },
                ],
            });

            expect(result.success).toBe(true);
        });

        it('accepts batch response with breakdowns', () => {
            const result = batchScoreResponseSchema.safeParse({
                results: [
                    {
                        leadId: 'lead-1',
                        score: 85,
                        breakdown: {
                            jobTitleScore: 90,
                            companyScore: 80,
                            profileCompletenessScore: 85,
                            activityScore: 70,
                            enrichmentScore: 90,
                            finalScore: 85,
                        },
                    },
                ],
                totalProcessed: 1,
                totalFailed: 0,
            });

            expect(result.success).toBe(true);
        });

        it('rejects negative totalProcessed', () => {
            const result = batchScoreResponseSchema.safeParse({
                results: [],
                totalProcessed: -1,
                totalFailed: 0,
            });

            expect(result.success).toBe(false);
        });

        it('rejects negative totalFailed', () => {
            const result = batchScoreResponseSchema.safeParse({
                results: [],
                totalProcessed: 0,
                totalFailed: -1,
            });

            expect(result.success).toBe(false);
        });
    });
});

describe('companySizeSchema', () => {
    it('accepts all valid company size enum values', () => {
        const validSizes = [
            'SIZE_1_10',
            'SIZE_11_50',
            'SIZE_51_200',
            'SIZE_201_500',
            'SIZE_501_1000',
            'SIZE_1001_5000',
            'SIZE_5001_10000',
            'SIZE_10001_PLUS',
        ];

        for (const size of validSizes) {
            const result = companySizeSchema.safeParse(size);
            expect(result.success).toBe(true);
        }
    });

    it('rejects invalid company size values', () => {
        const invalidSizes = [
            'SIZE_0',
            'SIZE_1',
            'SMALL',
            'LARGE',
            '1-10',
            '',
        ];

        for (const size of invalidSizes) {
            const result = companySizeSchema.safeParse(size);
            expect(result.success).toBe(false);
        }
    });
});
