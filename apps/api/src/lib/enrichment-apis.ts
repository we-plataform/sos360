import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Unified enrichment provider interface
 * All enrichment providers (Clearbit, Apollo, Hunter) must implement this interface
 */
export interface EnrichmentProvider {
    /**
     * Provider name (e.g., 'clearbit', 'apollo', 'hunter')
     */
    name: string;

    /**
     * Enrich lead data by email address
     * @param email - Email address to lookup
     * @returns Enriched data or null if not found
     */
    enrichByEmail(email: string): Promise<EnrichmentResult | null>;

    /**
     * Enrich company data by domain
     * @param domain - Company domain (e.g., 'acme.com')
     * @returns Enriched company data or null if not found
     */
    enrichByDomain(domain: string): Promise<EnrichmentResult | null>;

    /**
     * Enrich lead data by LinkedIn profile URL
     * @param linkedInUrl - LinkedIn profile URL
     * @returns Enriched data or null if not found
     */
    enrichByLinkedInUrl(linkedInUrl: string): Promise<EnrichmentResult | null>;

    /**
     * Check if provider is properly configured with API key
     */
    isConfigured(): boolean;

    /**
     * Get credit cost for this provider per request
     */
    getCreditsCost(): number;
}

/**
 * Standardized enrichment result structure
 * Normalized data from all providers
 */
export type EnrichmentResult = {
    /**
     * Provider that generated this result
     */
    provider: string;

    /**
     * Confidence score (0-100) indicating data reliability
     */
    confidenceScore: number;

    /**
     * Number of credits consumed for this enrichment
     */
    creditsCost: number;

    /**
     * Company information
     */
    company?: {
        name?: string;
        domain?: string;
        industry?: string;
        size?: string;        // e.g., '11-50', '51-200'
        location?: string;    // City, Country
        website?: string;
        description?: string;
        foundedYear?: number;
        revenue?: string;
    };

    /**
     * Contact/person information
     */
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

    /**
     * Technology stack detected
     */
    technologies?: string[];

    /**
     * Additional social profiles discovered
     */
    socialProfiles?: Record<string, string>; // platform -> url

    /**
     * Raw data from provider for debugging/fallback
     */
    raw?: any;

    /**
     * Timestamp when data was fetched
     */
    fetchedAt?: string;
};

/**
 * Base enrichment provider with common functionality
 */
export abstract class BaseEnrichmentProvider implements EnrichmentProvider {
    abstract name: string;
    protected apiKey: string | null;
    protected creditsCost: number;

    constructor(apiKey: string | null, defaultCreditsCost: number = 1) {
        this.apiKey = apiKey;
        this.creditsCost = defaultCreditsCost;
    }

    abstract enrichByEmail(email: string): Promise<EnrichmentResult | null>;
    abstract enrichByDomain(domain: string): Promise<EnrichmentResult | null>;
    abstract enrichByLinkedInUrl(linkedInUrl: string): Promise<EnrichmentResult | null>;

    isConfigured(): boolean {
        return !!this.apiKey;
    }

    getCreditsCost(): number {
        return this.creditsCost;
    }

    /**
     * Normalize company data from provider-specific format
     */
    protected normalizeCompany(data: any): EnrichmentResult['company'] {
        if (!data) return undefined;

        return {
            name: data.name || data.companyName,
            domain: data.domain || data.website?.replace(/^https?:\/\//, '')?.replace(/\/$/, ''),
            industry: data.industry || data.category,
            size: data.size || data.employeesCount || data.employeeRange,
            location: data.location || data.city || `${data.city || ''}, ${data.state || ''} ${data.country || ''}`.trim(),
            website: data.website || data.url || data.site,
            description: data.description || data.bio || data.tagline,
            foundedYear: data.foundedYear || data.founded,
            revenue: data.revenue || data.annualRevenue,
        };
    }

    /**
     * Normalize contact data from provider-specific format
     */
    protected normalizeContact(data: any): EnrichmentResult['contact'] {
        if (!data) return undefined;

        return {
            fullName: data.fullName || data.name,
            firstName: data.firstName || data.givenName,
            lastName: data.lastName || data.familyName,
            email: data.email,
            emailVerified: data.emailVerified || data.confidence === 'high',
            phone: data.phone || data.mobilePhone || data.workPhone,
            title: data.title || data.jobTitle || data.position,
            linkedInUrl: data.linkedInUrl || data.linkedin,
            twitterHandle: data.twitterHandle || data.twitter,
        };
    }

    /**
     * Calculate confidence score based on data completeness
     */
    protected calculateConfidence(result: Partial<EnrichmentResult>): number {
        let score = 0;
        const maxScore = 100;

        // Company data (up to 40 points)
        if (result.company) {
            if (result.company.name) score += 10;
            if (result.company.industry) score += 8;
            if (result.company.size) score += 8;
            if (result.company.location) score += 7;
            if (result.company.website) score += 7;
        }

        // Contact data (up to 40 points)
        if (result.contact) {
            if (result.contact.fullName) score += 10;
            if (result.contact.email) score += 12;
            if (result.contact.emailVerified) score += 8;
            if (result.contact.title) score += 5;
            if (result.contact.phone) score += 5;
        }

        // Technology data (up to 10 points)
        if (result.technologies && result.technologies.length > 0) {
            score += Math.min(10, result.technologies.length * 2);
        }

        // Social profiles (up to 10 points)
        if (result.socialProfiles && Object.keys(result.socialProfiles).length > 0) {
            score += Math.min(10, Object.keys(result.socialProfiles).length * 3);
        }

        return Math.min(maxScore, score);
    }

    /**
     * Create standardized enrichment result
     */
    protected createResult(
        data: any,
        rawData?: any
    ): EnrichmentResult {
        const result: Partial<EnrichmentResult> = {
            provider: this.name,
            creditsCost: this.creditsCost,
            raw: rawData,
            fetchedAt: new Date().toISOString(),
        };

        if (data) {
            result.company = this.normalizeCompany(data.company || data);
            result.contact = this.normalizeContact(data.contact || data.person || data);
            result.technologies = data.technologies || data.tech;
            result.socialProfiles = data.socialProfiles || data.socials;
        }

        result.confidenceScore = this.calculateConfidence(result);

        return result as EnrichmentResult;
    }
}

/**
 * Clearbit API client for company/contact enrichment
 * https://clearbit.com/docs
 */
export class ClearbitClient extends BaseEnrichmentProvider {
    name = 'clearbit';
    private static instance: ClearbitClient | null = null;

    constructor(apiKey: string | null) {
        super(apiKey, 1); // 1 credit per request
        if (!apiKey) {
            logger.warn('CLEARBIT_API_KEY not set. Clearbit enrichment disabled.');
        }
    }

    static getInstance(): ClearbitClient | null {
        if (!ClearbitClient.instance) {
            ClearbitClient.instance = new ClearbitClient(env.CLEARBIT_API_KEY || null);
        }
        return ClearbitClient.instance;
    }

    async enrichByEmail(email: string): Promise<EnrichmentResult | null> {
        if (!this.isConfigured()) {
            logger.warn('Clearbit not configured, skipping email enrichment');
            return null;
        }

        try {
            const url = new URL('https://person.clearbit.com/v2/combined/find');
            url.searchParams.append('email', email);

            const response = await fetch(url.toString(), {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            if (!response.ok) {
                if (response.status === 404) {
                    logger.debug({ email }, 'Clearbit: Person not found');
                    return null;
                }
                if (response.status === 429) {
                    logger.warn({ email }, 'Clearbit: Rate limit exceeded');
                    return null;
                }
                throw new Error(`Clearbit API error: ${response.status} ${response.statusText}`);
            }

            const data: any = await response.json();

            // Map Clearbit response to our EnrichmentResult format
            return this.createResult(
                {
                    company: data.company,
                    contact: data.person,
                    technologies: data.company?.tech,
                    socialProfiles: data.person?.social?.length ? {
                        linkedin: data.person.social.find((s: any) => s.type === 'linkedin')?.url,
                        twitter: data.person.social.find((s: any) => s.type === 'twitter')?.url,
                        facebook: data.person.social.find((s: any) => s.type === 'facebook')?.url,
                        github: data.person.social.find((s: any) => s.type === 'github')?.url,
                    } : undefined,
                },
                data
            );
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                logger.warn({ email }, 'Clearbit email enrichment timeout');
                return null;
            }
            logger.error({ err: error, email }, 'Clearbit email enrichment failed');
            return null;
        }
    }

    async enrichByDomain(domain: string): Promise<EnrichmentResult | null> {
        if (!this.isConfigured()) {
            logger.warn('Clearbit not configured, skipping domain enrichment');
            return null;
        }

        try {
            // Clean domain - remove protocol, path, www prefix
            const cleanDomain = domain
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .split('/')[0]
                .toLowerCase();

            const url = new URL('https://company.clearbit.com/v2/companies/find');
            url.searchParams.append('domain', cleanDomain);

            const response = await fetch(url.toString(), {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            if (!response.ok) {
                if (response.status === 404) {
                    logger.debug({ domain: cleanDomain }, 'Clearbit: Company not found');
                    return null;
                }
                if (response.status === 429) {
                    logger.warn({ domain: cleanDomain }, 'Clearbit: Rate limit exceeded');
                    return null;
                }
                throw new Error(`Clearbit API error: ${response.status} ${response.statusText}`);
            }

            const data: any = await response.json();

            // Map Clearbit response to our EnrichmentResult format
            return this.createResult(
                {
                    company: {
                        name: data.name,
                        domain: data.domain,
                        industry: data.category?.industry,
                        size: data.metrics?.employeesRange,
                        location: data.location,
                        website: data.site?.url,
                        description: data.description || data.tagline,
                        foundedYear: data.foundedYear,
                        revenue: data.metrics?.annualRevenue,
                    },
                    technologies: data.tech || [],
                },
                data
            );
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                logger.warn({ domain }, 'Clearbit domain enrichment timeout');
                return null;
            }
            logger.error({ err: error, domain }, 'Clearbit domain enrichment failed');
            return null;
        }
    }

    async enrichByLinkedInUrl(linkedInUrl: string): Promise<EnrichmentResult | null> {
        if (!this.isConfigured()) {
            logger.warn('Clearbit not configured, skipping LinkedIn enrichment');
            return null;
        }

        try {
            // Clearbit doesn't directly support LinkedIn URL lookup
            // We can try to extract email/domain if available in the URL or profile
            // For now, we'll return null as this requires scraping or additional data
            logger.debug({ linkedInUrl }, 'Clearbit does not support direct LinkedIn URL lookup');
            return null;
        } catch (error) {
            logger.error({ err: error, linkedInUrl }, 'Clearbit LinkedIn enrichment failed');
            return null;
        }
    }
}

/**
 * Apollo.io API client for contact data enrichment
 * https://apollo.io/developer
 */
export class ApolloClient extends BaseEnrichmentProvider {
    name = 'apollo';
    private static instance: ApolloClient | null = null;

    constructor(apiKey: string | null) {
        super(apiKey, 2); // 2 credits per request (Apollo is more expensive)
        if (!apiKey) {
            logger.warn('APOLLO_API_KEY not set. Apollo.io enrichment disabled.');
        }
    }

    static getInstance(): ApolloClient | null {
        if (!ApolloClient.instance) {
            ApolloClient.instance = new ApolloClient(env.APOLLO_API_KEY || null);
        }
        return ApolloClient.instance;
    }

    async enrichByEmail(email: string): Promise<EnrichmentResult | null> {
        if (!this.isConfigured()) {
            logger.warn('Apollo not configured, skipping email enrichment');
            return null;
        }

        try {
            const response = await fetch('https://api.apollo.io/v1/match_people', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Api-Key': this.apiKey!,
                },
                body: JSON.stringify({ email }),
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            if (!response.ok) {
                if (response.status === 404) {
                    logger.debug({ email }, 'Apollo: Person not found');
                    return null;
                }
                if (response.status === 429) {
                    logger.warn({ email }, 'Apollo: Rate limit exceeded');
                    return null;
                }
                throw new Error(`Apollo API error: ${response.status} ${response.statusText}`);
            }

            const data: any = await response.json();

            // Apollo returns a person object with matched_person and organization
            const person = data.matched_person || data.person;
            const organization = data.organization || data.matched_person?.organization;

            if (!person) {
                logger.debug({ email }, 'Apollo: No person data found');
                return null;
            }

            // Map Apollo response to our EnrichmentResult format
            return this.createResult(
                {
                    company: organization ? {
                        name: organization.name,
                        domain: organization.website?.replace(/^https?:\/\//, '')?.replace(/\/$/, ''),
                        industry: organization.industry,
                        size: organization.employees_count?.toString() || organization.employee_range,
                        location: organization.primary_location?.city || organization.headquarter_location,
                        website: organization.website,
                        description: organization.description || organization.tagline,
                        foundedYear: organization.founded_year,
                        revenue: organization.annual_revenue?.toString(),
                    } : undefined,
                    contact: {
                        fullName: person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim(),
                        firstName: person.first_name,
                        lastName: person.last_name,
                        email: person.email || email,
                        emailVerified: person.email_status === 'verified',
                        phone: person.phone_number || person.mobile_number,
                        title: person.title || person.headline,
                        linkedInUrl: person.linkedin_url,
                        twitterHandle: person.twitter_handle,
                    },
                },
                data
            );
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                logger.warn({ email }, 'Apollo email enrichment timeout');
                return null;
            }
            logger.error({ err: error, email }, 'Apollo email enrichment failed');
            return null;
        }
    }

    async enrichByDomain(domain: string): Promise<EnrichmentResult | null> {
        if (!this.isConfigured()) {
            logger.warn('Apollo not configured, skipping domain enrichment');
            return null;
        }

        try {
            // Clean domain - remove protocol, path, www prefix
            const cleanDomain = domain
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .split('/')[0]
                .toLowerCase();

            const response = await fetch('https://api.apollo.io/v1/match_organization', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Api-Key': this.apiKey!,
                },
                body: JSON.stringify({ domain: cleanDomain }),
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            if (!response.ok) {
                if (response.status === 404) {
                    logger.debug({ domain: cleanDomain }, 'Apollo: Organization not found');
                    return null;
                }
                if (response.status === 429) {
                    logger.warn({ domain: cleanDomain }, 'Apollo: Rate limit exceeded');
                    return null;
                }
                throw new Error(`Apollo API error: ${response.status} ${response.statusText}`);
            }

            const data: any = await response.json();

            const organization = data.organization || data.matched_organization;

            if (!organization) {
                logger.debug({ domain: cleanDomain }, 'Apollo: No organization data found');
                return null;
            }

            // Map Apollo response to our EnrichmentResult format
            return this.createResult(
                {
                    company: {
                        name: organization.name,
                        domain: organization.website?.replace(/^https?:\/\//, '')?.replace(/\/$/, '') || cleanDomain,
                        industry: organization.industry,
                        size: organization.employees_count?.toString() || organization.employee_range,
                        location: organization.primary_location?.city || organization.headquarter_location,
                        website: organization.website,
                        description: organization.description || organization.tagline || organization.overview,
                        foundedYear: organization.founded_year,
                        revenue: organization.annual_revenue?.toString() || organization.revenue_range,
                    },
                },
                data
            );
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                logger.warn({ domain }, 'Apollo domain enrichment timeout');
                return null;
            }
            logger.error({ err: error, domain }, 'Apollo domain enrichment failed');
            return null;
        }
    }

    async enrichByLinkedInUrl(linkedInUrl: string): Promise<EnrichmentResult | null> {
        if (!this.isConfigured()) {
            logger.warn('Apollo not configured, skipping LinkedIn enrichment');
            return null;
        }

        try {
            const response = await fetch('https://api.apollo.io/v1/match_people', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Api-Key': this.apiKey!,
                },
                body: JSON.stringify({ linkedin_url: linkedInUrl }),
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            if (!response.ok) {
                if (response.status === 404) {
                    logger.debug({ linkedInUrl }, 'Apollo: Person not found by LinkedIn URL');
                    return null;
                }
                if (response.status === 429) {
                    logger.warn({ linkedInUrl }, 'Apollo: Rate limit exceeded');
                    return null;
                }
                throw new Error(`Apollo API error: ${response.status} ${response.statusText}`);
            }

            const data: any = await response.json();

            const person = data.matched_person || data.person;
            const organization = data.organization || data.matched_person?.organization;

            if (!person) {
                logger.debug({ linkedInUrl }, 'Apollo: No person data found from LinkedIn URL');
                return null;
            }

            // Map Apollo response to our EnrichmentResult format
            return this.createResult(
                {
                    company: organization ? {
                        name: organization.name,
                        domain: organization.website?.replace(/^https?:\/\//, '')?.replace(/\/$/, ''),
                        industry: organization.industry,
                        size: organization.employees_count?.toString() || organization.employee_range,
                        location: organization.primary_location?.city || organization.headquarter_location,
                        website: organization.website,
                        description: organization.description || organization.tagline,
                        foundedYear: organization.founded_year,
                        revenue: organization.annual_revenue?.toString(),
                    } : undefined,
                    contact: {
                        fullName: person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim(),
                        firstName: person.first_name,
                        lastName: person.last_name,
                        email: person.email,
                        emailVerified: person.email_status === 'verified',
                        phone: person.phone_number || person.mobile_number,
                        title: person.title || person.headline,
                        linkedInUrl: person.linkedin_url || linkedInUrl,
                        twitterHandle: person.twitter_handle,
                    },
                },
                data
            );
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                logger.warn({ linkedInUrl }, 'Apollo LinkedIn enrichment timeout');
                return null;
            }
            logger.error({ err: error, linkedInUrl }, 'Apollo LinkedIn enrichment failed');
            return null;
        }
    }
}

/**
 * Hunter.io API client for email verification and finder
 * https://hunter.io/docs
 */
export class HunterClient extends BaseEnrichmentProvider {
    name = 'hunter';
    private static instance: HunterClient | null = null;

    constructor(apiKey: string | null) {
        super(apiKey, 1); // 1 credit per request
        if (!apiKey) {
            logger.warn('HUNTER_API_KEY not set. Hunter.io enrichment disabled.');
        }
    }

    static getInstance(): HunterClient | null {
        if (!HunterClient.instance) {
            HunterClient.instance = new HunterClient(env.HUNTER_API_KEY || null);
        }
        return HunterClient.instance;
    }

    async enrichByEmail(email: string): Promise<EnrichmentResult | null> {
        if (!this.isConfigured()) {
            logger.warn('Hunter not configured, skipping email enrichment');
            return null;
        }

        try {
            const url = new URL('https://api.hunter.io/v2/email-verifier');
            url.searchParams.append('email', email);
            url.searchParams.append('api_key', this.apiKey!);

            const response = await fetch(url.toString(), {
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            if (!response.ok) {
                if (response.status === 404) {
                    logger.debug({ email }, 'Hunter: Email not found');
                    return null;
                }
                if (response.status === 429) {
                    logger.warn({ email }, 'Hunter: Rate limit exceeded');
                    return null;
                }
                throw new Error(`Hunter API error: ${response.status} ${response.statusText}`);
            }

            const data: any = await response.json();

            // Hunter returns { data: { email, status, score, ... } }
            const emailData = data.data;

            if (!emailData) {
                logger.debug({ email }, 'Hunter: No email data found');
                return null;
            }

            // Map Hunter response to our EnrichmentResult format
            // Hunter focuses on email verification, so we mainly enrich contact data
            return this.createResult(
                {
                    company: emailData.company ? {
                        name: emailData.company,
                    } : undefined,
                    contact: {
                        email: emailData.email,
                        emailVerified: emailData.status === 'valid',
                        firstName: emailData.first_name,
                        lastName: emailData.last_name,
                        fullName: emailData.first_name || emailData.last_name
                            ? `${emailData.first_name || ''} ${emailData.last_name || ''}`.trim()
                            : undefined,
                    },
                },
                data
            );
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                logger.warn({ email }, 'Hunter email enrichment timeout');
                return null;
            }
            logger.error({ err: error, email }, 'Hunter email enrichment failed');
            return null;
        }
    }

    async enrichByDomain(domain: string): Promise<EnrichmentResult | null> {
        if (!this.isConfigured()) {
            logger.warn('Hunter not configured, skipping domain enrichment');
            return null;
        }

        try {
            // Clean domain - remove protocol, path, www prefix
            const cleanDomain = domain
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .split('/')[0]
                .toLowerCase();

            const url = new URL('https://api.hunter.io/v2/domain-search');
            url.searchParams.append('domain', cleanDomain);
            url.searchParams.append('api_key', this.apiKey!);

            const response = await fetch(url.toString(), {
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            if (!response.ok) {
                if (response.status === 404) {
                    logger.debug({ domain: cleanDomain }, 'Hunter: Domain not found');
                    return null;
                }
                if (response.status === 429) {
                    logger.warn({ domain: cleanDomain }, 'Hunter: Rate limit exceeded');
                    return null;
                }
                throw new Error(`Hunter API error: ${response.status} ${response.statusText}`);
            }

            const data: any = await response.json();

            // Hunter returns { data: { domain, emails: [], ... } }
            const domainData = data.data;

            if (!domainData) {
                logger.debug({ domain: cleanDomain }, 'Hunter: No domain data found');
                return null;
            }

            // Map Hunter response to our EnrichmentResult format
            // Hunter domain search provides company info and a list of emails
            return this.createResult(
                {
                    company: {
                        name: domainData.company || undefined,
                        domain: domainData.domain,
                        industry: domainData.industry || undefined,
                        location: domainData.country || undefined,
                        description: domainData.description || undefined,
                    },
                    // Hunter may return multiple emails, we can include the first one as contact
                    contact: domainData.emails && domainData.emails.length > 0 ? {
                        fullName: domainData.emails[0].first_name || domainData.emails[0].last_name
                            ? `${domainData.emails[0].first_name || ''} ${domainData.emails[0].last_name || ''}`.trim()
                            : undefined,
                        firstName: domainData.emails[0].first_name,
                        lastName: domainData.emails[0].last_name,
                        email: domainData.emails[0].value,
                        emailVerified: domainData.emails[0].confidence === 'high',
                        title: domainData.emails[0].position || undefined,
                    } : undefined,
                },
                data
            );
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                logger.warn({ domain }, 'Hunter domain enrichment timeout');
                return null;
            }
            logger.error({ err: error, domain }, 'Hunter domain enrichment failed');
            return null;
        }
    }

    async enrichByLinkedInUrl(linkedInUrl: string): Promise<EnrichmentResult | null> {
        // Hunter doesn't support LinkedIn URL lookup directly
        logger.warn({ linkedInUrl }, 'Hunter does not support LinkedIn URL lookup');
        return null;
    }
}

/**
 * Get all available enrichment providers
 */
export function getAvailableProviders(): EnrichmentProvider[] {
    const providers: EnrichmentProvider[] = [];

    const clearbit = ClearbitClient.getInstance();
    if (clearbit?.isConfigured()) {
        providers.push(clearbit);
    }

    const apollo = ApolloClient.getInstance();
    if (apollo?.isConfigured()) {
        providers.push(apollo);
    }

    const hunter = HunterClient.getInstance();
    if (hunter?.isConfigured()) {
        providers.push(hunter);
    }

    return providers;
}

/**
 * Check if any enrichment provider is available
 */
export function hasEnrichmentAvailable(): boolean {
    return getAvailableProviders().length > 0;
}

/**
 * Enrich a lead using all available providers
 * @param email - Lead email address
 * @param domain - Lead company domain (optional)
 * @param linkedInUrl - Lead LinkedIn URL (optional)
 * @returns Array of enrichment results from all providers
 */
export async function enrichWithAllProviders(
    email?: string,
    domain?: string,
    linkedInUrl?: string
): Promise<EnrichmentResult[]> {
    const providers = getAvailableProviders();
    const results: EnrichmentResult[] = [];

    if (providers.length === 0) {
        logger.warn('No enrichment providers configured');
        return results;
    }

    // Try each provider with the available data
    for (const provider of providers) {
        try {
            let result: EnrichmentResult | null = null;

            // Try enrichment by email first (most specific)
            if (email && !result) {
                result = await provider.enrichByEmail(email);
            }

            // Try enrichment by domain
            if (domain && !result) {
                result = await provider.enrichByDomain(domain);
            }

            // Try enrichment by LinkedIn URL
            if (linkedInUrl && !result) {
                result = await provider.enrichByLinkedInUrl(linkedInUrl);
            }

            if (result) {
                results.push(result);
            }
        } catch (error) {
            logger.error({ err: error, provider: provider.name }, 'Provider enrichment failed');
        }
    }

    return results;
}
