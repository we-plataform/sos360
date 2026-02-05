import { z } from 'zod';

// Note: These schemas are used with validate() middleware which passes req.body directly
export const createCloudBrowserSessionSchema = z.object({
    platform: z.enum(['linkedin', 'instagram', 'facebook', 'twitter']).default('linkedin'),
    connectorIds: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
});

export const createCloudBrowserTaskSchema = z.object({
    sessionId: z.string(),
    prompt: z.string(),
    metadata: z.record(z.unknown()).optional(),
});

export const listCloudBrowserSessionsSchema = z.object({
    platform: z.string().optional(),
    status: z.enum(['active', 'expired', 'revoked']).optional(),
});

export const listCloudBrowserTasksSchema = z.object({
    sessionId: z.string().optional(),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
    limit: z.string().optional().transform((val) => val ? Number(val) : undefined),
});

export const scrapeLinkedInProfileSchema = z.object({
    sessionId: z.string(),
    profileUrl: z.string().url(),
});

export const searchLinkedInLeadsSchema = z.object({
    sessionId: z.string(),
    searchQuery: z.string(),
    maxResults: z.number().optional().default(10),
});

export const sendLinkedInConnectionSchema = z.object({
    sessionId: z.string(),
    profileUrl: z.string().url(),
    note: z.string().optional(),
});

