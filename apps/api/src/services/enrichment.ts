import { prisma, Lead, EnrichmentStatus, CompanySize } from '@lia360/database';
import { logger } from '../lib/logger.js';
import {
    enrichWithAllProviders,
    getAvailableProviders,
    type EnrichmentResult
} from '../lib/enrichment-apis.js';

/**
 * Enrichment result with metadata
 */
export type EnrichmentResultWithMeta = EnrichmentResult & {
    merged: boolean;
    timestamp: string;
};

/**
 * Lead enrichment breakdown with details
 */
export type LeadEnrichmentBreakdown = {
    success: boolean;
    status: EnrichmentStatus;
    results: EnrichmentResultWithMeta[];
    mergedData: MergedEnrichmentData;
    creditsUsed: number;
    confidenceScore: number;
    error?: string;
};

/**
 * Merged enrichment data from all providers
 */
export type MergedEnrichmentData = {
    company?: {
        name?: string;
        domain?: string;
        industry?: string;
        size?: CompanySize;
        location?: string;
        website?: string;
        description?: string;
        foundedYear?: number;
        revenue?: string;
    };
    contact?: {
        fullName?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        emailVerified?: boolean;
        phone?: string;
        title?: string;
        linkedInUrl?: string;
        twitterHandle?: string;
    };
    technologies?: string[];
    socialProfiles?: Record<string, string>;
    sources: string[]; // Which providers contributed data
    confidenceScore: number;
};

/**
 * Extended Lead type with relations needed for enrichment
 */
type LeadWithRelations = Lead & {
    contactInfo?: {
        id: string;
        email?: string;
        phone?: string;
    } | null;
};

/**
 * Enrich a lead using all available enrichment providers
 * @param leadId - The lead ID to enrich
 * @param workspaceId - The workspace ID for credit tracking
 * @returns Enrichment breakdown with merged data
 */
export async function enrichLead(
    leadId: string,
    workspaceId: string
): Promise<LeadEnrichmentBreakdown> {
    try {
        // Fetch lead with relations
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            include: {
                contactInfo: {
                    select: {
                        id: true,
                        email: true,
                        phone: true,
                    },
                },
            },
        });

        if (!lead) {
            throw new Error(`Lead ${leadId} not found`);
        }

        // Verify lead belongs to the workspace
        if (lead.workspaceId !== workspaceId) {
            throw new Error('Lead does not belong to this workspace');
        }

        // Check if enrichment providers are available
        const providers = getAvailableProviders();
        if (providers.length === 0) {
            logger.warn({ leadId }, 'No enrichment providers configured');
            return {
                success: false,
                status: 'failed',
                results: [],
                mergedData: {
                    sources: [],
                    confidenceScore: 0,
                },
                creditsUsed: 0,
                confidenceScore: 0,
                error: 'No enrichment providers configured',
            };
        }

        // Check available credits
        const credit = await getOrCreateEnrichmentCredit(workspaceId);
        const estimatedCost = providers.length;

        if (credit.creditsAvailable < estimatedCost) {
            logger.warn({ leadId, creditsAvailable: credit.creditsAvailable, estimatedCost }, 'Insufficient enrichment credits');
            return {
                success: false,
                status: 'failed',
                results: [],
                mergedData: {
                    sources: [],
                    confidenceScore: 0,
                },
                creditsUsed: 0,
                confidenceScore: 0,
                error: `Insufficient credits. Available: ${credit.creditsAvailable}, Required: ${estimatedCost}`,
            };
        }

        // Extract enrichment identifiers from lead
        const email = lead.email || lead.contactInfo?.email;
        const domain = extractDomainFromLead(lead);
        const linkedInUrl = lead.profileUrl || undefined;

        // Enrich using all available providers
        const enrichResults = await enrichWithAllProviders(email, domain, linkedInUrl);

        if (enrichResults.length === 0) {
            logger.warn({ leadId }, 'No enrichment results from any provider');
            await updateLeadEnrichmentStatus(leadId, 'failed');
            return {
                success: false,
                status: 'failed',
                results: [],
                mergedData: {
                    sources: [],
                    confidenceScore: 0,
                },
                creditsUsed: 0,
                confidenceScore: 0,
                error: 'No data found from any enrichment provider',
            };
        }

        // Merge results from all providers
        const mergedData = mergeEnrichmentData(enrichResults);
        const totalCreditsUsed = enrichResults.reduce((sum, r) => sum + r.creditsCost, 0);

        // Track enrichment usage
        await trackEnrichmentUsage(
            workspaceId,
            leadId,
            enrichResults,
            totalCreditsUsed,
            'success'
        );

        // Update lead with enriched data
        await updateLeadWithEnrichedData(leadId, mergedData);

        // Update lead enrichment status
        const finalStatus = calculateEnrichmentStatus(mergedData);
        await updateLeadEnrichmentStatus(leadId, finalStatus);

        logger.info({
            leadId,
            providersUsed: enrichResults.length,
            creditsUsed: totalCreditsUsed,
            confidenceScore: mergedData.confidenceScore,
            status: finalStatus,
        }, 'Lead enrichment completed');

        return {
            success: true,
            status: finalStatus,
            results: enrichResults.map(r => ({
                ...r,
                merged: true,
                timestamp: new Date().toISOString(),
            })),
            mergedData,
            creditsUsed: totalCreditsUsed,
            confidenceScore: mergedData.confidenceScore,
        };
    } catch (error) {
        logger.error({ err: error, leadId }, 'Failed to enrich lead');

        // Track failed enrichment
        try {
            const lead = await prisma.lead.findUnique({
                where: { id: leadId },
                select: { workspaceId: true },
            });
            if (lead) {
                await trackEnrichmentUsage(
                    lead.workspaceId,
                    leadId,
                    [],
                    0,
                    'failed',
                    error instanceof Error ? error.message : 'Unknown error'
                );
            }
        } catch (trackError) {
            logger.error({ err: trackError, leadId }, 'Failed to track enrichment error');
        }

        throw error;
    }
}

/**
 * Merge enrichment data from multiple providers
 * @param results - Array of enrichment results from providers
 * @returns Merged enrichment data with confidence score
 */
export function mergeEnrichmentData(results: EnrichmentResult[]): MergedEnrichmentData {
    const merged: MergedEnrichmentData = {
        sources: [],
        confidenceScore: 0,
    };

    if (results.length === 0) {
        return merged;
    }

    // Collect all providers that contributed
    merged.sources = results.map(r => r.provider);

    // Merge company data (prefer higher confidence results)
    const sortedResults = [...results].sort((a, b) => b.confidenceScore - a.confidenceScore);

    for (const result of sortedResults) {
        if (result.company) {
            if (!merged.company) {
                merged.company = {};
            }
            // Fill in missing fields
            merged.company.name = merged.company.name || result.company.name;
            merged.company.domain = merged.company.domain || result.company.domain;
            merged.company.industry = merged.company.industry || result.company.industry;
            merged.company.size = merged.company.size || normalizeCompanySize(result.company.size);
            merged.company.location = merged.company.location || result.company.location;
            merged.company.website = merged.company.website || result.company.website;
            merged.company.description = merged.company.description || result.company.description;
            merged.company.foundedYear = merged.company.foundedYear || result.company.foundedYear;
            merged.company.revenue = merged.company.revenue || result.company.revenue;
        }

        if (result.contact) {
            if (!merged.contact) {
                merged.contact = {};
            }
            // Prefer verified emails
            if (result.contact.email) {
                if (!merged.contact.email || (result.contact.emailVerified && !merged.contact.emailVerified)) {
                    merged.contact.email = result.contact.email;
                    merged.contact.emailVerified = result.contact.emailVerified;
                }
            }
            merged.contact.fullName = merged.contact.fullName || result.contact.fullName;
            merged.contact.firstName = merged.contact.firstName || result.contact.firstName;
            merged.contact.lastName = merged.contact.lastName || result.contact.lastName;
            merged.contact.phone = merged.contact.phone || result.contact.phone;
            merged.contact.title = merged.contact.title || result.contact.title;
            merged.contact.linkedInUrl = merged.contact.linkedInUrl || result.contact.linkedInUrl;
            merged.contact.twitterHandle = merged.contact.twitterHandle || result.contact.twitterHandle;
        }

        // Merge technologies (combine all unique)
        if (result.technologies && result.technologies.length > 0) {
            if (!merged.technologies) {
                merged.technologies = [];
            }
            for (const tech of result.technologies) {
                if (!merged.technologies.includes(tech)) {
                    merged.technologies.push(tech);
                }
            }
        }

        // Merge social profiles
        if (result.socialProfiles && Object.keys(result.socialProfiles).length > 0) {
            if (!merged.socialProfiles) {
                merged.socialProfiles = {};
            }
            Object.assign(merged.socialProfiles, result.socialProfiles);
        }
    }

    // Calculate overall confidence score
    merged.confidenceScore = calculateConfidenceScore(merged, results);

    return merged;
}

/**
 * Calculate confidence score based on merged data and source results
 * @param mergedData - Merged enrichment data
 * @param sourceResults - Original enrichment results from providers
 * @returns Confidence score (0-100)
 */
export function calculateConfidenceScore(
    mergedData: MergedEnrichmentData,
    sourceResults: EnrichmentResult[]
): number {
    let score = 0;
    const maxScore = 100;

    // Base score from number of providers (more providers = higher confidence)
    const providerCount = sourceResults.length;
    score += Math.min(20, providerCount * 10); // Max 20 points from multiple providers

    // Company data completeness (up to 30 points)
    if (mergedData.company) {
        const companyFields = [
            mergedData.company.name,
            mergedData.company.domain,
            mergedData.company.industry,
            mergedData.company.size,
            mergedData.company.location,
            mergedData.company.website,
        ];
        const filledCompanyFields = companyFields.filter(f => f !== null && f !== undefined && f !== '').length;
        score += (filledCompanyFields / companyFields.length) * 30;
    }

    // Contact data completeness (up to 30 points)
    if (mergedData.contact) {
        const contactFields = [
            mergedData.contact.fullName,
            mergedData.contact.email,
            mergedData.contact.phone,
            mergedData.contact.title,
        ];
        const filledContactFields = contactFields.filter(f => f !== null && f !== undefined && f !== '').length;
        score += (filledContactFields / contactFields.length) * 30;

        // Bonus for verified email (5 points)
        if (mergedData.contact.emailVerified) {
            score += 5;
        }
    }

    // Technology stack (up to 10 points)
    if (mergedData.technologies && mergedData.technologies.length > 0) {
        score += Math.min(10, mergedData.technologies.length * 2);
    }

    // Social profiles (up to 5 points)
    if (mergedData.socialProfiles && Object.keys(mergedData.socialProfiles).length > 0) {
        score += Math.min(5, Object.keys(mergedData.socialProfiles).length * 2);
    }

    return Math.min(maxScore, Math.round(score));
}

/**
 * Get or create enrichment credit for a workspace
 * @param workspaceId - The workspace ID
 * @returns Enrichment credit record
 */
export async function getOrCreateEnrichmentCredit(workspaceId: string) {
    let credit = await prisma.enrichmentCredit.findUnique({
        where: { workspaceId },
    });

    if (!credit) {
        // Create default credit allocation (1000 credits for trial)
        credit = await prisma.enrichmentCredit.create({
            data: {
                workspaceId,
                creditsAvailable: 1000,
                creditsUsed: 0,
            },
        });
        logger.info({ workspaceId, creditsAvailable: 1000 }, 'Created enrichment credit for workspace');
    }

    return credit;
}

/**
 * Track enrichment usage and deduct credits
 * @param workspaceId - The workspace ID
 * @param leadId - The lead ID
 * @param results - Enrichment results from providers
 * @param creditsUsed - Total credits consumed
 * @param status - Usage status (success, failed)
 * @param errorMessage - Optional error message
 */
export async function trackEnrichmentUsage(
    workspaceId: string,
    leadId: string,
    results: EnrichmentResult[],
    creditsUsed: number,
    status: 'success' | 'failed',
    errorMessage?: string
) {
    try {
        // Create enrichment usage records for each provider
        for (const result of results) {
            await prisma.enrichmentUsage.create({
                data: {
                    workspaceId,
                    leadId,
                    creditId: workspaceId, // Will be linked properly in the next step
                    provider: result.provider,
                    endpoint: 'enrichment',
                    creditsCost: result.creditsCost,
                    status,
                    errorMessage,
                    metadata: {
                        confidenceScore: result.confidenceScore,
                        hasCompanyData: !!result.company,
                        hasContactData: !!result.contact,
                        hasTechnologies: !!result.technologies?.length,
                    },
                    completedAt: status === 'success' ? new Date() : undefined,
                },
            });
        }

        // If failed with no results, still create a usage record
        if (results.length === 0 && status === 'failed') {
            await prisma.enrichmentUsage.create({
                data: {
                    workspaceId,
                    leadId,
                    creditId: workspaceId,
                    provider: 'unknown',
                    endpoint: 'enrichment',
                    creditsCost: 0,
                    status,
                    errorMessage,
                    completedAt: new Date(),
                },
            });
        }

        // Deduct credits from workspace
        if (creditsUsed > 0) {
            await prisma.enrichmentCredit.update({
                where: { workspaceId },
                data: {
                    creditsUsed: {
                        increment: creditsUsed,
                    },
                    creditsAvailable: {
                        decrement: creditsUsed,
                    },
                },
            });

            logger.info({
                workspaceId,
                leadId,
                creditsUsed,
                providersCount: results.length,
            }, 'Enrichment usage tracked and credits deducted');
        }
    } catch (error) {
        logger.error({ err: error, workspaceId, leadId }, 'Failed to track enrichment usage');
        // Don't throw - tracking failure shouldn't break enrichment
    }
}

/**
 * Update lead with enriched data
 * @param leadId - The lead ID
 * @param mergedData - Merged enrichment data
 */
async function updateLeadWithEnrichedData(
    leadId: string,
    mergedData: MergedEnrichmentData
) {
    try {
        const updateData: any = {
            enrichedAt: new Date(),
        };

        // Update lead fields with enriched data
        if (mergedData.contact) {
            if (mergedData.contact.fullName && !updateData.fullName) {
                updateData.fullName = mergedData.contact.fullName;
            }
            if (mergedData.contact.email) {
                updateData.email = mergedData.contact.email;
            }
            if (mergedData.contact.phone) {
                updateData.phone = mergedData.contact.phone;
            }
        }

        if (mergedData.company) {
            if (mergedData.company.name) {
                updateData.company = mergedData.company.name;
            }
            if (mergedData.company.industry) {
                updateData.industry = mergedData.company.industry;
            }
            if (mergedData.company.size) {
                updateData.companySize = mergedData.company.size;
            }
            if (mergedData.contact?.title) {
                updateData.jobTitle = mergedData.contact.title;
            }
            if (mergedData.company.location && !updateData.location) {
                updateData.location = mergedData.company.location;
            }
            if (mergedData.company.website && !updateData.website) {
                updateData.website = mergedData.company.website;
            }
        }

        await prisma.lead.update({
            where: { id: leadId },
            data: updateData,
        });

        // Update or create contact info
        if (mergedData.contact && (mergedData.contact.email || mergedData.contact.phone)) {
            await prisma.leadContactInfo.upsert({
                where: { leadId },
                create: {
                    leadId,
                    email: mergedData.contact.email,
                    phone: mergedData.contact.phone,
                    website: mergedData.company?.website,
                    profileUrl: mergedData.contact.linkedInUrl,
                    twitter: mergedData.contact.twitterHandle,
                },
                update: {
                    email: mergedData.contact.email || undefined,
                    phone: mergedData.contact.phone || undefined,
                    website: mergedData.company?.website,
                    profileUrl: mergedData.contact.linkedInUrl,
                    twitter: mergedData.contact.twitterHandle,
                },
            });
        }

        logger.debug({ leadId }, 'Lead updated with enriched data');
    } catch (error) {
        logger.error({ err: error, leadId }, 'Failed to update lead with enriched data');
        throw error;
    }
}

/**
 * Update lead enrichment status
 * @param leadId - The lead ID
 * @param status - Enrichment status
 */
async function updateLeadEnrichmentStatus(
    leadId: string,
    status: EnrichmentStatus
) {
    try {
        await prisma.lead.update({
            where: { id: leadId },
            data: { enrichmentStatus: status },
        });
    } catch (error) {
        logger.error({ err: error, leadId }, 'Failed to update lead enrichment status');
        throw error;
    }
}

/**
 * Calculate enrichment status based on merged data
 * @param mergedData - Merged enrichment data
 * @returns Enrichment status
 */
function calculateEnrichmentStatus(mergedData: MergedEnrichmentData): EnrichmentStatus {
    if (mergedData.confidenceScore >= 70) {
        return 'complete';
    } else if (mergedData.confidenceScore >= 40) {
        return 'partial';
    } else {
        return 'failed';
    }
}

/**
 * Extract domain from lead data
 * @param lead - Lead object
 * @returns Domain string or undefined
 */
function extractDomainFromLead(lead: Lead | LeadWithRelations): string | undefined {
    // Try to extract from website
    if (lead.website) {
        try {
            const url = new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`);
            return url.hostname.replace(/^www\./, '');
        } catch {
            // Invalid URL, continue
        }
    }

    // Try to extract from email (check both direct email and contactInfo email)
    const email = lead.email || ('contactInfo' in lead && lead.contactInfo?.email);
    if (email) {
        const match = email.match(/@([^\s@]+)$/);
        if (match && match[1]) {
            return match[1];
        }
    }

    // Try to guess domain from company name
    if (lead.company) {
        // Simple heuristic: company name + .com
        // This is a fallback and may not be accurate
        const domainGuess = lead.company.toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .replace(/\s+/g, '') + '.com';
        return domainGuess;
    }

    return undefined;
}

/**
 * Normalize company size string to CompanySize enum
 * @param size - Company size string
 * @returns CompanySize enum value or undefined
 */
function normalizeCompanySize(size: string | undefined): CompanySize | undefined {
    if (!size) {
        return undefined;
    }

    const normalized = size.toLowerCase().trim();

    // Try to match against enum values
    const sizeMappings: Record<string, CompanySize> = {
        '1-10': 'SIZE_1_10',
        '1-50': 'SIZE_1_10',
        '11-50': 'SIZE_11_50',
        '51-200': 'SIZE_51_200',
        '201-500': 'SIZE_201_500',
        '501-1000': 'SIZE_501_1000',
        '1001-5000': 'SIZE_1001_5000',
        '5001-10000': 'SIZE_5001_10000',
        '10000+': 'SIZE_10001_PLUS',
        '10001+': 'SIZE_10001_PLUS',
    };

    // Direct match
    if (sizeMappings[normalized]) {
        return sizeMappings[normalized];
    }

    // Pattern matching
    if (normalized.match(/^1\s*-\s*10$/) || normalized.match(/^[1-9]\s?(people|employees)?$/)) {
        return 'SIZE_1_10';
    }
    if (normalized.match(/^1\d\s*-\s*50$/) || normalized.match(/^1\d\d?\s?(people|employees)?$/)) {
        return 'SIZE_11_50';
    }
    if (normalized.match(/^[5-9]\d\s*-\s*200$/)) {
        return 'SIZE_51_200';
    }
    if (normalized.match(/^20\d\s*-\s*500$/)) {
        return 'SIZE_201_500';
    }
    if (normalized.match(/^50\d\s*-\s*1000$/)) {
        return 'SIZE_501_1000';
    }
    if (normalized.match(/^100\d\s*-\s*5000$/)) {
        return 'SIZE_1001_5000';
    }
    if (normalized.match(/^500\d\s*-\s*10000$/)) {
        return 'SIZE_5001_10000';
    }
    if (normalized.match(/^10000\+$/) || normalized.match(/^10k\+$/)) {
        return 'SIZE_10001_PLUS';
    }

    return undefined;
}

/**
 * Batch enrich multiple leads
 * @param leadIds - Array of lead IDs to enrich
 * @param workspaceId - The workspace ID
 * @returns Array of enrichment breakdowns
 */
export async function batchEnrichLeads(
    leadIds: string[],
    workspaceId: string
): Promise<Array<{ leadId: string; breakdown: LeadEnrichmentBreakdown; error?: string }>> {
    const results: Array<{ leadId: string; breakdown: LeadEnrichmentBreakdown; error?: string }> = [];

    for (const leadId of leadIds) {
        try {
            const breakdown = await enrichLead(leadId, workspaceId);
            results.push({ leadId, breakdown });
        } catch (error) {
            logger.error({ err: error, leadId }, 'Failed to enrich lead in batch');
            results.push({
                leadId,
                breakdown: {
                    success: false,
                    status: 'failed',
                    results: [],
                    mergedData: {
                        sources: [],
                        confidenceScore: 0,
                    },
                    creditsUsed: 0,
                    confidenceScore: 0,
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    return results;
}

/**
 * Get enrichment usage statistics for a workspace
 * @param workspaceId - The workspace ID
 * @returns Usage statistics
 */
export async function getEnrichmentUsageStats(workspaceId: string) {
    const credit = await getOrCreateEnrichmentCredit(workspaceId);

    const usages = await prisma.enrichmentUsage.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });

    const successfulEnrichments = await prisma.enrichmentUsage.count({
        where: {
            workspaceId,
            status: 'success',
        },
    });

    const failedEnrichments = await prisma.enrichmentUsage.count({
        where: {
            workspaceId,
            status: 'failed',
        },
    });

    return {
        creditsAvailable: credit.creditsAvailable,
        creditsUsed: credit.creditsUsed,
        totalEnrichments: successfulEnrichments + failedEnrichments,
        successfulEnrichments,
        failedEnrichments,
        recentUsages: usages,
    };
}
