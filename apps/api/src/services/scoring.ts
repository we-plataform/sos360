import { prisma } from '@lia360/database';
import { logger } from '../lib/logger.js';
import { analyzeLead } from '../lib/openai.js';

// ============================================
// TYPES
// ============================================

export interface ScoringCriteria {
  jobTitles: {
    target: string[];
    exclude: string[];
    seniority: string[];
  };
  companies: {
    industries: string[];
    sizes: string[];
    excludeIndustries: string[];
  };
  engagement: {
    minFollowers?: number;
    minConnections?: number;
    hasRecentPosts?: boolean;
  };
  completeness: {
    required: string[];
    bonus: string[];
  };
}

export interface ScoringWeights {
  jobTitle: number;
  company: number;
  engagement: number;
  completeness: number;
}

export interface ScoreFactor {
  score: number;
  reason: string;
}

export interface ScoreBreakdown {
  jobTitle: ScoreFactor;
  company: ScoreFactor;
  engagement: ScoreFactor;
  completeness: ScoreFactor;
}

export interface ScoringResult {
  score: number;
  factors: ScoreBreakdown;
  reason: string;
  classification: 'hot' | 'warm' | 'cold';
}

export interface ScoringModelConfig {
  id: string;
  name: string;
  enabled: boolean;
  criteria: ScoringCriteria;
  weights: ScoringWeights;
  thresholdHigh: number;
  thresholdMedium: number;
  systemPrompt?: string;
}

// ============================================
// SCORING SERVICE
// ============================================

class ScoringService {
  /**
   * Get scoring model configuration for a pipeline
   */
  async getScoringModel(pipelineId: string): Promise<ScoringModelConfig | null> {
    const model = await prisma.scoringModel.findUnique({
      where: { pipelineId },
    });

    if (!model || !model.enabled) {
      return null;
    }

    return {
      id: model.id,
      name: model.name,
      enabled: model.enabled,
      criteria: model.criteria as unknown as ScoringCriteria,
      weights: model.weights as unknown as ScoringWeights,
      thresholdHigh: model.thresholdHigh,
      thresholdMedium: model.thresholdMedium,
      systemPrompt: model.systemPrompt || undefined,
    };
  }

  /**
   * Create or update scoring model for a pipeline
   */
  async upsertScoringModel(
    pipelineId: string,
    data: {
      name: string;
      description?: string;
      enabled?: boolean;
      criteria: ScoringCriteria;
      weights: ScoringWeights;
      thresholdHigh?: number;
      thresholdMedium?: number;
      systemPrompt?: string;
    }
  ): Promise<ScoringModelConfig> {
    const model = await prisma.scoringModel.upsert({
      where: { pipelineId },
      create: {
        pipelineId,
        name: data.name,
        description: data.description,
        enabled: data.enabled ?? true,
        criteria: data.criteria as any,
        weights: data.weights as any,
        thresholdHigh: data.thresholdHigh ?? 80,
        thresholdMedium: data.thresholdMedium ?? 50,
        systemPrompt: data.systemPrompt,
      },
      update: {
        name: data.name,
        description: data.description,
        enabled: data.enabled ?? true,
        criteria: data.criteria as any,
        weights: data.weights as any,
        thresholdHigh: data.thresholdHigh ?? 80,
        thresholdMedium: data.thresholdMedium ?? 50,
        systemPrompt: data.systemPrompt,
      },
    });

    return {
      id: model.id,
      name: model.name,
      enabled: model.enabled,
      criteria: model.criteria as unknown as ScoringCriteria,
      weights: model.weights as unknown as ScoringWeights,
      thresholdHigh: model.thresholdHigh,
      thresholdMedium: model.thresholdMedium,
      systemPrompt: model.systemPrompt || undefined,
    };
  }

  /**
   * Score a single lead using OpenAI
   */
  async scoreLead(
    leadId: string,
    triggeredBy: string = 'manual'
  ): Promise<ScoringResult | null> {
    // Fetch lead with enrichment data
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        pipelineStage: {
          include: {
            pipeline: {
              include: {
                scoringModel: true,
              },
            },
          },
        },
        experiences: true,
        educations: true,
        skills: true,
        leadPosts: { take: 5, orderBy: { date: 'desc' } },
      },
    });

    if (!lead || !lead.pipelineStage?.pipeline?.scoringModel) {
      logger.warn({ leadId }, 'Lead not found or no scoring model configured');
      return null;
    }

    const scoringModel = lead.pipelineStage.pipeline.scoringModel;
    if (!scoringModel.enabled) {
      logger.info({ leadId, pipelineId: scoringModel.pipelineId }, 'Scoring model disabled');
      return null;
    }

    const criteria = scoringModel.criteria as unknown as ScoringCriteria;
    const weights = scoringModel.weights as unknown as ScoringWeights;

    // Build criteria description for OpenAI
    const criteriaText = this.buildCriteriaDescription(criteria);

    // Build lead profile for OpenAI
    const leadProfile = this.buildLeadProfile(lead);

    // Call OpenAI for analysis
    const analysis = await analyzeLead(leadProfile, criteriaText);

    // Calculate detailed scores for each factor
    const factors = await this.calculateDetailedFactors(lead, criteria);

    // Calculate weighted final score
    const finalScore = this.calculateWeightedScore(factors, weights);

    // Determine classification
    const classification = this.getClassification(
      finalScore,
      scoringModel.thresholdHigh,
      scoringModel.thresholdMedium
    );

    // Store score history
    await this.recordScoreHistory(
      leadId,
      lead.score,
      finalScore,
      analysis.reason,
      factors,
      triggeredBy
    );

    // Update lead score
    await prisma.lead.update({
      where: { id: leadId },
      data: { score: finalScore },
    });

    return {
      score: finalScore,
      factors,
      reason: analysis.reason,
      classification,
    };
  }

  /**
   * Batch score multiple leads
   */
  async batchScoreLeads(
    leadIds: string[],
    triggeredBy: string = 'batch_job'
  ): Promise<{ processed: number; succeeded: number; failed: number; errors: string[] }> {
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const leadId of leadIds) {
      try {
        results.processed++;
        await this.scoreLead(leadId, triggeredBy);
        results.succeeded++;
      } catch (error) {
        results.failed++;
        results.errors.push(`${leadId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        logger.error({ leadId, error }, 'Batch scoring failed for lead');
      }
    }

    return results;
  }

  /**
   * Get score history for a lead
   */
  async getScoreHistory(leadId: string, limit: number = 20) {
    return prisma.scoreHistory.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get detailed score breakdown for a lead
   */
  async getScoreBreakdown(leadId: string): Promise<ScoringResult | null> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        pipelineStage: {
          include: {
            pipeline: {
              include: {
                scoringModel: true,
              },
            },
          },
        },
      },
    });

    if (!lead || !lead.pipelineStage?.pipeline?.scoringModel) {
      return null;
    }

    const scoringModel = lead.pipelineStage.pipeline.scoringModel;
    const criteria = scoringModel.criteria as unknown as ScoringCriteria;
    const weights = scoringModel.weights as unknown as ScoringWeights;

    const factors = await this.calculateDetailedFactors(lead, criteria);
    const finalScore = this.calculateWeightedScore(factors, weights);
    const classification = this.getClassification(
      finalScore,
      scoringModel.thresholdHigh,
      scoringModel.thresholdMedium
    );

    return {
      score: finalScore,
      factors,
      reason: `Current score: ${finalScore}/100`,
      classification,
    };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Build criteria description for OpenAI prompt
   */
  private buildCriteriaDescription(criteria: ScoringCriteria): string {
    const parts: string[] = [];

    if (criteria.jobTitles.target.length > 0) {
      parts.push(`Target job titles: ${criteria.jobTitles.target.join(', ')}`);
    }
    if (criteria.jobTitles.exclude.length > 0) {
      parts.push(`Exclude job titles: ${criteria.jobTitles.exclude.join(', ')}`);
    }
    if (criteria.companies.industries.length > 0) {
      parts.push(`Target industries: ${criteria.companies.industries.join(', ')}`);
    }
    if (criteria.companies.sizes.length > 0) {
      parts.push(`Target company sizes: ${criteria.companies.sizes.join(', ')}`);
    }

    return parts.join('. ');
  }

  /**
   * Build lead profile for OpenAI
   */
  private buildLeadProfile(lead: any): any {
    return {
      username: lead.username || 'unknown',
      fullName: lead.fullName || '',
      bio: lead.bio || '',
      headline: lead.headline || '',
      company: lead.company || '',
      industry: lead.industry || '',
      location: lead.location || '',
      followersCount: lead.followersCount,
      connectionCount: lead.connectionCount,
      postsCount: lead.leadPosts.length,
      platform: lead.platform || 'unknown',
    };
  }

  /**
   * Calculate detailed scores for each factor
   */
  private async calculateDetailedFactors(
    lead: any,
    criteria: ScoringCriteria
  ): Promise<ScoreBreakdown> {
    const jobTitle = this.scoreJobTitle(lead, criteria);
    const company = this.scoreCompany(lead, criteria);
    const engagement = this.scoreEngagement(lead, criteria);
    const completeness = this.scoreCompleteness(lead, criteria);

    return { jobTitle, company, engagement, completeness };
  }

  /**
   * Score job title match
   */
  private scoreJobTitle(lead: any, criteria: ScoringCriteria): ScoreFactor {
    const { target, exclude, seniority } = criteria.jobTitles;

    // Get job title from various fields
    const title =
      lead.jobTitle ||
      lead.headline ||
      lead.experiences?.[0]?.roleTitle ||
      '';

    if (!title) {
      return { score: 0, reason: 'No job title information available' };
    }

    // Check exclusions first
    if (exclude.some((ex) => title.toLowerCase().includes(ex.toLowerCase()))) {
      return { score: 0, reason: 'Job title matches exclusion criteria' };
    }

    // Check for exact matches
    if (target.some((t) => title.toLowerCase().includes(t.toLowerCase()))) {
      return { score: 95, reason: 'Job title matches target profile exactly' };
    }

    // Check for seniority matches
    if (seniority.some((s) => title.toLowerCase().includes(s.toLowerCase()))) {
      return { score: 75, reason: 'Job title matches target seniority level' };
    }

    return { score: 40, reason: 'Job title available but not a clear match' };
  }

  /**
   * Score company relevance
   */
  private scoreCompany(lead: any, criteria: ScoringCriteria): ScoreFactor {
    const { industries, sizes, excludeIndustries } = criteria.companies;

    const company = lead.company || '';
    const industry = lead.industry || '';
    const companySize = lead.companySize || '';

    // Check exclusions
    if (excludeIndustries.length > 0) {
      const combinedIndustry = (company + ' ' + industry).toLowerCase();
      if (excludeIndustries.some((ex) => combinedIndustry.includes(ex.toLowerCase()))) {
        return { score: 0, reason: 'Company matches excluded industry' };
      }
    }

    // Check industry match
    if (industries.length > 0) {
      const combinedIndustry = (company + ' ' + industry).toLowerCase();
      if (industries.some((ind) => combinedIndustry.includes(ind.toLowerCase()))) {
        // Bonus for size match
        if (sizes.length > 0 && sizes.includes(companySize)) {
          return { score: 95, reason: 'Company matches target industry and size' };
        }
        return { score: 80, reason: 'Company matches target industry' };
      }
    }

    // Check size only
    if (sizes.length > 0 && sizes.includes(companySize)) {
      return { score: 65, reason: 'Company size matches target' };
    }

    if (!company && !industry) {
      return { score: 0, reason: 'No company information available' };
    }

    return { score: 45, reason: 'Company information available but not a clear match' };
  }

  /**
   * Score engagement/activity
   */
  private scoreEngagement(lead: any, criteria: ScoringCriteria): ScoreFactor {
    const { minFollowers, minConnections, hasRecentPosts } = criteria.engagement;

    let score = 0;
    const reasons: string[] = [];

    // Followers score
    if (lead.followersCount) {
      if (minFollowers && lead.followersCount >= minFollowers) {
        score += 30;
        reasons.push(`Good follower count (${lead.followersCount})`);
      } else {
        score += Math.min(20, Math.floor((lead.followersCount / 1000) * 20));
        reasons.push(`Follower count: ${lead.followersCount}`);
      }
    }

    // Connections score (LinkedIn)
    if (lead.connectionCount) {
      if (minConnections && lead.connectionCount >= minConnections) {
        score += 30;
        reasons.push(`Strong network (${lead.connectionCount} connections)`);
      } else {
        score += Math.min(20, Math.floor((lead.connectionCount / 500) * 20));
        reasons.push(`Connections: ${lead.connectionCount}`);
      }
    }

    // Posts score
    if (hasRecentPosts) {
      if (lead.postsCount && lead.postsCount > 0) {
        score += 25;
        reasons.push(`Active poster (${lead.postsCount} posts)`);
      } else {
        score += 10;
        reasons.push('Some post activity');
      }
    }

    // Verification bonus
    if (lead.verified) {
      score += 15;
      reasons.push('Verified account');
    }

    if (score === 0) {
      return { score: 0, reason: 'No engagement data available' };
    }

    return { score: Math.min(100, score), reason: reasons.join('. ') };
  }

  /**
   * Score profile completeness
   */
  private scoreCompleteness(lead: any, criteria: ScoringCriteria): ScoreFactor {
    // Destructure to avoid unused parameter warning (using default fields for now)
    void criteria.completeness;

    let score = 0;
    const reasons: string[] = [];

    // Check required fields
    const requiredFields = {
      email: lead.email,
      jobTitle: lead.jobTitle || lead.headline,
      company: lead.company,
      bio: lead.bio,
    };

    const presentRequired = Object.values(requiredFields).filter((v) => v).length;
    const requiredScore = (presentRequired / Object.keys(requiredFields).length) * 60;
    score += requiredScore;
    reasons.push(`${presentRequired}/${Object.keys(requiredFields).length} required fields`);

    // Check bonus fields
    const bonusFields = {
      phone: lead.phone,
      website: lead.website,
      location: lead.location,
      experiences: lead.experiences?.length > 0,
      educations: lead.educations?.length > 0,
      skills: lead.skills?.length > 0,
    };

    const presentBonus = Object.values(bonusFields).filter((v) => v).length;
    const bonusScore = (presentBonus / Object.keys(bonusFields).length) * 40;
    score += bonusScore;
    if (presentBonus > 0) {
      reasons.push(`${presentBonus}/${Object.keys(bonusFields).length} bonus fields`);
    }

    return { score: Math.round(score), reason: reasons.join('. ') };
  }

  /**
   * Calculate weighted final score
   */
  private calculateWeightedScore(factors: ScoreBreakdown, weights: ScoringWeights): number {
    const weightedSum =
      factors.jobTitle.score * weights.jobTitle +
      factors.company.score * weights.company +
      factors.engagement.score * weights.engagement +
      factors.completeness.score * weights.completeness;

    const totalWeight =
      weights.jobTitle + weights.company + weights.engagement + weights.completeness;

    return Math.round(weightedSum / totalWeight);
  }

  /**
   * Determine lead classification
   */
  private getClassification(
    score: number,
    thresholdHigh: number,
    thresholdMedium: number
  ): 'hot' | 'warm' | 'cold' {
    if (score >= thresholdHigh) return 'hot';
    if (score >= thresholdMedium) return 'warm';
    return 'cold';
  }

  /**
   * Record score history
   */
  private async recordScoreHistory(
    leadId: string,
    oldScore: number,
    newScore: number,
    reason: string,
    factors: ScoreBreakdown,
    triggeredBy: string
  ): Promise<void> {
    await prisma.scoreHistory.create({
      data: {
        leadId,
        oldScore,
        newScore,
        reason,
        factors: factors as any,
        triggeredBy,
      },
    });
  }
}

// Export singleton instance
export const scoringService = new ScoringService();
