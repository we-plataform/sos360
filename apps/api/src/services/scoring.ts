import { prisma, Lead, ScoringConfig, CompanySize } from '@lia360/database';
import { logger } from '../lib/logger.js';
import { analyzeLead, type LeadProfile } from '../lib/openai.js';

/**
 * Lead score breakdown with individual component scores
 */
export type LeadScoreBreakdown = {
    jobTitleScore: number;
    companyScore: number;
    profileCompletenessScore: number;
    activityScore: number;
    enrichmentScore: number;
    finalScore: number;
    explanation?: string;
};

/**
 * Extended Lead type with all relations needed for scoring
 */
type LeadWithRelations = Lead & {
    experiences?: { id: string }[];
    educations?: { id: string }[];
    skills?: { id: string }[];
    certifications?: { id: string }[];
    languages?: { id: string }[];
    contactInfo?: { id: string } | null;
    posts?: { id: string }[];
};

/**
 * Calculate the lead score based on scoring configuration and lead data
 * @param leadId - The lead ID to score
 * @param workspaceId - The workspace ID for configuration lookup
 * @returns Score breakdown with final score
 */
export async function calculateLeadScore(
    leadId: string,
    workspaceId: string
): Promise<LeadScoreBreakdown> {
    try {
        // Fetch lead with all relations needed for scoring
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            include: {
                experiences: { select: { id: true } },
                educations: { select: { id: true } },
                skills: { select: { id: true } },
                certifications: { select: { id: true } },
                languages: { select: { id: true } },
                contactInfo: { select: { id: true } },
                posts: { select: { id: true } },
            },
        });

        if (!lead) {
            throw new Error(`Lead ${leadId} not found`);
        }

        // Verify lead belongs to the workspace
        if (lead.workspaceId !== workspaceId) {
            throw new Error('Lead does not belong to this workspace');
        }

        // Fetch scoring config for workspace (or use default)
        let config = await prisma.scoringConfig.findUnique({
            where: { workspaceId },
        });

        if (!config) {
            // Create default config if none exists
            config = await prisma.scoringConfig.create({
                data: {
                    workspaceId,
                    jobTitleWeight: 25,
                    companyWeight: 20,
                    profileCompletenessWeight: 15,
                    activityWeight: 20,
                    enrichmentWeight: 20,
                    targetJobTitles: [],
                    targetCompanySizes: [],
                    targetIndustries: [],
                    minProfileCompleteness: 50,
                    autoScoreOnImport: true,
                    autoScoreOnUpdate: true,
                },
            });
        }

        // Calculate individual scores
        const jobTitleScore = calculateJobTitleScore(lead, config);
        const companyScore = calculateCompanyScore(lead, config);
        const profileCompletenessScore = calculateProfileCompletenessScore(lead);
        const activityScore = calculateActivityScore(lead);
        const enrichmentScore = calculateEnrichmentScore(lead);

        // Calculate weighted final score
        const finalScore = Math.round(
            (jobTitleScore * config.jobTitleWeight +
                companyScore * config.companyWeight +
                profileCompletenessScore * config.profileCompletenessWeight +
                activityScore * config.activityWeight +
                enrichmentScore * config.enrichmentWeight) / 100
        );

        // Get AI-powered explanation
        let explanation = generateExplanation(lead, config, {
            jobTitleScore,
            companyScore,
            profileCompletenessScore,
            activityScore,
            enrichmentScore,
            finalScore,
        });

        // Try to enhance with OpenAI analysis
        try {
            const profile = buildLeadProfile(lead);
            const criteria = buildCriteriaDescription(config);
            const analysisResult = await analyzeLead(profile, criteria);
            explanation = analysisResult.reason || explanation;
        } catch (error) {
            logger.warn({ err: error, leadId }, 'Failed to get AI explanation, using default');
        }

        const breakdown: LeadScoreBreakdown = {
            jobTitleScore,
            companyScore,
            profileCompletenessScore,
            activityScore,
            enrichmentScore,
            finalScore,
            explanation,
        };

        // Update lead score in database
        await prisma.lead.update({
            where: { id: leadId },
            data: { score: finalScore },
        });

        logger.info({ leadId, finalScore }, 'Lead score calculated');

        return breakdown;
    } catch (error) {
        logger.error({ err: error, leadId }, 'Failed to calculate lead score');
        throw error;
    }
}

/**
 * Calculate job title match score (0-100)
 */
function calculateJobTitleScore(lead: Lead, config: ScoringConfig): number {
    if (config.targetJobTitles.length === 0) {
        // No targeting criteria, give neutral score
        return 50;
    }

    const jobTitle = (lead.jobTitle || lead.headline || '').toLowerCase();
    if (!jobTitle) {
        return 0;
    }

    // Check for exact or partial matches
    let score = 0;
    for (const targetTitle of config.targetJobTitles) {
        const target = targetTitle.toLowerCase();
        if (jobTitle === target) {
            score = 100; // Exact match
            break;
        } else if (jobTitle.includes(target) || target.includes(jobTitle)) {
            score = Math.max(score, 75); // Partial match
        }
    }

    // If no match found but has a job title, give some credit
    if (score === 0 && jobTitle) {
        score = 25;
    }

    return score;
}

/**
 * Calculate company relevance score (0-100)
 */
function calculateCompanyScore(lead: Lead, config: ScoringConfig): number {
    let score = 0;
    let factors = 0;

    // Company size match
    if (config.targetCompanySizes.length > 0) {
        factors++;
        if (lead.companySize && config.targetCompanySizes.includes(lead.companySize as CompanySize)) {
            score += 100;
        }
    }

    // Industry match
    if (config.targetIndustries.length > 0) {
        factors++;
        const leadIndustry = (lead.industry || '').toLowerCase();
        if (leadIndustry) {
            for (const targetIndustry of config.targetIndustries) {
                if (leadIndustry.includes(targetIndustry.toLowerCase()) ||
                    targetIndustry.toLowerCase().includes(leadIndustry)) {
                    score += 100;
                    break;
                }
            }
        }
    }

    // Company name presence
    factors++;
    if (lead.company) {
        score += 50; // Having a company is worth something
    }

    // If no targeting criteria, give neutral score
    if (factors === 0) {
        return 50;
    }

    return Math.round(score / factors);
}

/**
 * Calculate profile completeness score (0-100)
 * Based on how many fields are filled in
 */
function calculateProfileCompletenessScore(lead: LeadWithRelations): number {
    const fields = [
        lead.fullName,
        lead.email,
        lead.phone,
        lead.location,
        lead.bio,
        lead.company,
        lead.jobTitle || lead.headline,
        lead.industry,
        lead.website,
        lead.avatarUrl,
        lead.profileUrl,
    ];

    const filledFields = fields.filter(f => f !== null && f !== undefined && f !== '').length;
    const baseScore = (filledFields / fields.length) * 60; // Max 60 from basic fields

    // Bonus points for enrichment data
    let enrichmentBonus = 0;
    if (lead.experiences && lead.experiences.length > 0) enrichmentBonus += 10;
    if (lead.educations && lead.educations.length > 0) enrichmentBonus += 10;
    if (lead.skills && lead.skills.length > 0) enrichmentBonus += 5;
    if (lead.certifications && lead.certifications.length > 0) enrichmentBonus += 5;
    if (lead.languages && lead.languages.length > 0) enrichmentBonus += 5;
    if (lead.contactInfo) enrichmentBonus += 5;

    return Math.min(100, Math.round(baseScore + enrichmentBonus));
}

/**
 * Calculate activity/engagement score (0-100)
 * Based on social metrics
 */
function calculateActivityScore(lead: LeadWithRelations): number {
    let score = 0;

    // Followers count (max 40 points)
    if (lead.followersCount !== null && lead.followersCount !== undefined) {
        if (lead.followersCount >= 10000) score += 40;
        else if (lead.followersCount >= 5000) score += 35;
        else if (lead.followersCount >= 1000) score += 30;
        else if (lead.followersCount >= 500) score += 25;
        else if (lead.followersCount >= 100) score += 20;
        else score += 10;
    }

    // Connection count for LinkedIn (max 40 points)
    if (lead.connectionCount !== null && lead.connectionCount !== undefined) {
        if (lead.connectionCount >= 500) score += 40;
        else if (lead.connectionCount >= 250) score += 30;
        else if (lead.connectionCount >= 100) score += 20;
        else score += 10;
    }

    // Posts count (max 30 points)
    if (lead.postsCount !== null && lead.postsCount !== undefined) {
        if (lead.postsCount >= 100) score += 30;
        else if (lead.postsCount >= 50) score += 25;
        else if (lead.postsCount >= 20) score += 20;
        else if (lead.postsCount >= 5) score += 15;
        else score += 10;
    }

    // Recent posts (max 20 points)
    if (lead.posts && lead.posts.length > 0) {
        score += Math.min(20, lead.posts.length * 4);
    }

    // Verified status bonus (10 points)
    if (lead.verified) {
        score += 10;
    }

    return Math.min(100, score);
}

/**
 * Calculate enrichment data quality score (0-100)
 * Based on enrichment status and data completeness
 */
function calculateEnrichmentScore(lead: LeadWithRelations): number {
    let score = 0;

    // Base score from enrichment status
    switch (lead.enrichmentStatus) {
        case 'complete':
            score = 60;
            break;
        case 'partial':
            score = 40;
            break;
        case 'failed':
            score = 10;
            break;
        case 'none':
        default:
            score = 0;
            break;
    }

    // Bonus for specific enrichment data
    if (lead.experiences && lead.experiences.length > 0) {
        score += Math.min(15, lead.experiences.length * 5);
    }
    if (lead.educations && lead.educations.length > 0) {
        score += Math.min(10, lead.educations.length * 5);
    }
    if (lead.skills && lead.skills.length > 0) {
        score += Math.min(10, lead.skills.length * 2);
    }
    if (lead.certifications && lead.certifications.length > 0) {
        score += 5;
    }

    return Math.min(100, score);
}

/**
 * Generate human-readable explanation of the score
 */
function generateExplanation(
    _lead: Lead,
    config: ScoringConfig,
    breakdown: Omit<LeadScoreBreakdown, 'explanation'>
): string {
    const parts: string[] = [];

    // Overall assessment
    if (breakdown.finalScore >= 80) {
        parts.push('Lead altamente qualificado.');
    } else if (breakdown.finalScore >= 60) {
        parts.push('Lead qualificado.');
    } else if (breakdown.finalScore >= 40) {
        parts.push('Lead parcialmente qualificado.');
    } else {
        parts.push('Lead com baixa qualificação.');
    }

    // Key strengths
    const strengths: string[] = [];
    if (breakdown.jobTitleScore >= 70) strengths.push('cargo compatível');
    if (breakdown.companyScore >= 70) strengths.push('empresa relevante');
    if (breakdown.profileCompletenessScore >= 70) strengths.push('perfil completo');
    if (breakdown.activityScore >= 70) strengths.push('boa atividade social');
    if (breakdown.enrichmentScore >= 70) strengths.push('dados enriquecidos');

    if (strengths.length > 0) {
        parts.push('Pontos fortes: ' + strengths.join(', ') + '.');
    }

    // Key weaknesses
    const weaknesses: string[] = [];
    if (breakdown.jobTitleScore < 40 && config.targetJobTitles.length > 0) {
        weaknesses.push('cargo não corresponde ao perfil ideal');
    }
    if (breakdown.profileCompletenessScore < 40) {
        weaknesses.push('perfil incompleto');
    }
    if (breakdown.activityScore < 40) {
        weaknesses.push('baixa atividade social');
    }
    if (breakdown.enrichmentScore < 40) {
        weaknesses.push('dados não enriquecidos');
    }

    if (weaknesses.length > 0) {
        parts.push('Áreas de atenção: ' + weaknesses.join(', ') + '.');
    }

    return parts.join(' ');
}

/**
 * Batch calculate scores for multiple leads
 * @param leadIds - Array of lead IDs to score
 * @param workspaceId - The workspace ID for configuration lookup
 * @returns Array of score breakdowns
 */
export async function batchCalculateLeadScores(
    leadIds: string[],
    workspaceId: string
): Promise<Array<{ leadId: string; breakdown: LeadScoreBreakdown; error?: string }>> {
    const results: Array<{ leadId: string; breakdown: LeadScoreBreakdown; error?: string }> = [];

    for (const leadId of leadIds) {
        try {
            const breakdown = await calculateLeadScore(leadId, workspaceId);
            results.push({ leadId, breakdown });
        } catch (error) {
            logger.error({ err: error, leadId }, 'Failed to calculate score for lead in batch');
            results.push({
                leadId,
                breakdown: {
                    jobTitleScore: 0,
                    companyScore: 0,
                    profileCompletenessScore: 0,
                    activityScore: 0,
                    enrichmentScore: 0,
                    finalScore: 0,
                    explanation: 'Erro ao calcular pontuação',
                },
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    return results;
}

/**
 * Get or create scoring config for a workspace
 * @param workspaceId - The workspace ID
 * @returns The scoring configuration
 */
export async function getScoringConfig(workspaceId: string): Promise<ScoringConfig> {
    let config = await prisma.scoringConfig.findUnique({
        where: { workspaceId },
    });

    if (!config) {
        config = await prisma.scoringConfig.create({
            data: {
                workspaceId,
                jobTitleWeight: 25,
                companyWeight: 20,
                profileCompletenessWeight: 15,
                activityWeight: 20,
                enrichmentWeight: 20,
                targetJobTitles: [],
                targetCompanySizes: [],
                targetIndustries: [],
                minProfileCompleteness: 50,
                autoScoreOnImport: true,
                autoScoreOnUpdate: true,
            },
        });
    }

    return config;
}

/**
 * Update scoring configuration for a workspace
 * @param workspaceId - The workspace ID
 * @param data - Updated configuration data
 * @returns The updated scoring configuration
 */
export async function updateScoringConfig(
    workspaceId: string,
    data: Partial<Omit<ScoringConfig, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>
): Promise<ScoringConfig> {
    // Get or create config first
    await getScoringConfig(workspaceId);

    // Update it
    const config = await prisma.scoringConfig.update({
        where: { workspaceId },
        data,
    });

    logger.info({ workspaceId }, 'Scoring config updated');

    return config;
}

/**
 * Build a LeadProfile object for OpenAI analysis
 */
function buildLeadProfile(lead: Lead): LeadProfile {
    return {
        username: lead.username || 'unknown',
        fullName: lead.fullName,
        bio: lead.bio,
        headline: lead.headline,
        company: lead.company,
        industry: lead.industry,
        location: lead.location,
        followersCount: lead.followersCount || undefined,
        followingCount: lead.followingCount || undefined,
        connectionCount: lead.connectionCount || undefined,
        platform: lead.platform || undefined,
    };
}

/**
 * Build a human-readable description of scoring criteria for OpenAI
 */
function buildCriteriaDescription(config: ScoringConfig): string {
    const parts: string[] = [];

    if (config.targetJobTitles.length > 0) {
        parts.push(`Cargos-alvo: ${config.targetJobTitles.join(', ')}`);
    }

    if (config.targetIndustries.length > 0) {
        parts.push(`Setores: ${config.targetIndustries.join(', ')}`);
    }

    if (config.targetCompanySizes.length > 0) {
        const sizes = config.targetCompanySizes.map((s) => {
            switch (s) {
                case 'SIZE_1_10': return '1-10 funcionários';
                case 'SIZE_11_50': return '11-50 funcionários';
                case 'SIZE_51_200': return '51-200 funcionários';
                case 'SIZE_201_500': return '201-500 funcionários';
                case 'SIZE_501_1000': return '501-1000 funcionários';
                case 'SIZE_1001_5000': return '1001-5000 funcionários';
                case 'SIZE_5001_10000': return '5001-10000 funcionários';
                case 'SIZE_10001_PLUS': return '10000+ funcionários';
                default: return s;
            }
        });
        parts.push(`Tamanhos de empresa: ${sizes.join(', ')}`);
    }

    if (parts.length === 0) {
        return 'Perfil profissional de qualidade geral';
    }

    return parts.join('; ');
}

/**
 * Scoring service - provides high-level scoring operations
 */
export const scoringService = {
    /**
     * Batch score leads
     * @param leadIds - Array of lead IDs to score
     * @param trigger - What triggered this batch scoring (for logging)
     * @returns Result with succeeded/failed counts
     */
    async batchScoreLeads(
        leadIds: string[],
        trigger: string
    ): Promise<{
        succeeded: number;
        failed: number;
        errors?: string[];
    }> {
        try {
            // For now, we need to get workspaceId from the leads themselves
            // In production, this should be passed as a parameter
            if (leadIds.length === 0) {
                return { succeeded: 0, failed: 0, errors: [] };
            }

            // Get the first lead's workspace as a reference
            // Note: This assumes all leads in a batch are from the same workspace
            const firstLead = await prisma.lead.findUnique({
                where: { id: leadIds[0] },
                select: { workspaceId: true },
            });

            if (!firstLead) {
                return {
                    succeeded: 0,
                    failed: leadIds.length,
                    errors: ['First lead not found'],
                };
            }

            const results = await batchCalculateLeadScores(leadIds, firstLead.workspaceId);

            const succeeded = results.filter((r) => !r.error).length;
            const failed = results.filter((r) => r.error).length;
            const errors = results.filter((r) => r.error).map((r) => r.error!);

            logger.info(
                {
                    trigger,
                    total: leadIds.length,
                    succeeded,
                    failed,
                },
                'Batch scoring completed'
            );

            return { succeeded, failed, errors };
        } catch (error) {
            logger.error({ error, trigger }, 'Batch scoring failed');
            return {
                succeeded: 0,
                failed: leadIds.length,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            };
        }
    },
};
