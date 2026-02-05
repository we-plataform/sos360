/**
 * LinkedIn People Import API
 * Import leads from LinkedIn People search using Puppeteer
 */

import { Router } from 'express';
import { prisma } from '@lia360/database';
import { authenticate, authorize } from '../middleware/auth.js';
import { getSessionManager } from '../lib/self-hosted/session-manager.js';
import { createPeopleScraper } from '../lib/scrapers/linkedin-people-scraper.js';
import { logger } from '../lib/logger.js';
import type { ExtractedLead } from '../lib/scrapers/linkedin-people-scraper.js';

const router = Router();

/**
 * POST /api/v1/linkedin/scrape-people
 * Scrape leads from LinkedIn People search
 */
router.post(
  '/scrape-people',
  authenticate,
  authorize('workspace', 'admin'),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const {
        keywords,
        title,
        company,
        location,
        industry,
        maxLeads = 50,
        enrichProfiles = false,
        maxEnrichment = 10,
        pipelineStageId,
      } = req.body;

      // Verify pipeline stage belongs to workspace
      if (pipelineStageId) {
        const stage = await prisma.pipelineStage.findFirst({
          where: {
            id: pipelineStageId,
            pipeline: { workspaceId },
          },
        });

        if (!stage) {
          return res.status(400).json({
            success: false,
            error: 'Pipeline stage not found in this workspace',
          });
        }
      }

      logger.info(
        { workspaceId, keywords, maxLeads },
        'Starting LinkedIn People scraping'
      );

      // Acquire browser session
      const sessionManager = getSessionManager();
      const session = await sessionManager.acquire(workspaceId);

      try {
        const page = await sessionManager.getPage(session.id);
        const browser = session.browser;

        // Create scraper
        const scraper = await createPeopleScraper(browser);

        // Build filters
        const filters = {
          keywords,
          title,
          company,
          location,
          industry,
        };

        // Scrape People search
        const leads = await scraper.scrapePeopleSearch(filters, {
          maxLeads,
          enrichProfiles,
          maxEnrichment,
          humanLikeDelays: true,
        });

        // Optional: Enrich profiles
        let finalLeads = leads;
        if (enrichProfiles) {
          finalLeads = await scraper.enrichProfiles(maxEnrichment);
        }

        // Import leads to database
        const importResults = await importLeadsToDatabase(
          workspaceId,
          finalLeads,
          pipelineStageId
        );

        logger.info(
          {
            workspaceId,
            totalScraped: leads.length,
            imported: importResults.imported,
            duplicates: importResults.duplicates,
            errors: importResults.errors.length,
          },
          'LinkedIn People scraping completed'
        );

        res.json({
          success: true,
          data: {
            message: `Successfully scraped ${leads.length} leads from LinkedIn People search`,
            totalScraped: leads.length,
            imported: importResults.imported,
            duplicates: importResults.duplicates,
            errors: importResults.errors,
            leads: finalLeads.map((lead) => ({
              profileUrl: lead.profileUrl,
              fullName: lead.fullName,
              headline: lead.headline,
              location: lead.location,
            })),
          },
        });
      } finally {
        // Release session
        await sessionManager.release(session);
      }
    } catch (error) {
      logger.error({ error }, 'LinkedIn People scraping failed');
      next(error);
    }
  }
);

/**
 * POST /api/v1/linkedin/scrape-people-preview
 * Preview People search results without importing
 */
router.post(
  '/scrape-people-preview',
  authenticate,
  authorize('workspace', 'admin'),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const {
        keywords,
        title,
        company,
        location,
        industry,
        maxLeads = 20, // Lower limit for preview
      } = req.body;

      logger.info(
        { workspaceId, keywords, maxLeads },
        'Starting LinkedIn People preview'
      );

      // Acquire browser session
      const sessionManager = getSessionManager();
      const session = await sessionManager.acquire(workspaceId);

      try {
        const page = await sessionManager.getPage(session.id);
        const browser = session.browser;

        // Create scraper
        const scraper = await createPeopleScraper(browser);

        // Build filters
        const filters = {
          keywords,
          title,
          company,
          location,
          industry,
        };

        // Scrape with lower limit for preview
        const leads = await scraper.scrapePeopleSearch(filters, {
          maxLeads,
          enrichProfiles: false,
          humanLikeDelays: true,
        });

        logger.info(
          { workspaceId, previewCount: leads.length },
          'LinkedIn People preview completed'
        );

        res.json({
          success: true,
          data: {
            message: `Preview: Found ${leads.length} leads matching your criteria`,
            leads: leads.map((lead) => ({
              profileUrl: lead.profileUrl,
              fullName: lead.fullName,
              headline: lead.headline,
              location: lead.location,
              currentCompany: lead.currentCompany,
              currentTitle: lead.currentTitle,
              connectionDegree: lead.connectionDegree,
              tags: lead.tags,
            })),
          },
        });
      } finally {
        // Release session
        await sessionManager.release(session);
      }
    } catch (error) {
      logger.error({ error }, 'LinkedIn People preview failed');
      next(error);
    }
  }
);

/**
 * GET /api/v1/linkedin/search-filters
 * Get available search filters for LinkedIn People search
 */
router.get(
  '/search-filters',
  authenticate,
  (req, res) => {
    res.json({
      success: true,
      data: {
        filters: {
          keywords: {
            type: 'string',
            description: 'General keywords to search for',
            example: 'software engineer',
          },
          title: {
            type: 'string',
            description: 'Job title to filter by',
            example: 'Software Engineer',
          },
          company: {
            type: 'string',
            description: 'Company name',
            example: 'Google',
          },
          location: {
            type: 'string',
            description: 'Geographic location',
            example: 'San Francisco, California',
          },
          industry: {
            type: 'string',
            description: 'Industry',
            example: 'Computer Software',
          },
        },
        options: {
          maxLeads: {
            type: 'number',
            description: 'Maximum number of leads to scrape',
            default: 50,
            min: 1,
            max: 200,
          },
          enrichProfiles: {
            type: 'boolean',
            description: 'Whether to visit profiles for detailed data',
            default: false,
          },
          maxEnrichment: {
            type: 'number',
            description: 'Maximum number of profiles to enrich',
            default: 10,
            min: 1,
            max: 50,
          },
          pipelineStageId: {
            type: 'string',
            description: 'Pipeline stage ID to add leads to',
            required: false,
          },
        },
      },
    });
  }
);

/**
 * Import scraped leads to database
 */
async function importLeadsToDatabase(
  workspaceId: string,
  leads: ExtractedLead[],
  pipelineStageId?: string
): Promise<{
  imported: number;
  duplicates: number;
  errors: Array<{ lead: ExtractedLead; error: string }>;
}> {
  let imported = 0;
  let duplicates = 0;
  const errors: Array<{ lead: ExtractedLead; error: string }> = [];

  for (const lead of leads) {
    try {
      // Check if lead already exists
      const existing = await prisma.lead.findFirst({
        where: {
          workspaceId,
          profileUrl: lead.profileUrl,
        },
      });

      if (existing) {
        duplicates++;
        continue;
      }

      // Create lead
      await prisma.lead.create({
        data: {
          workspaceId,
          profileUrl: lead.profileUrl,
          fullName: lead.fullName,
          headline: lead.headline,
          avatarUrl: lead.profilePicture,
          location: lead.location,
          platform: 'linkedin',
          pipelineStageId,
          // Store scraped data in custom fields
          customFields: {
            scrapedData: {
              currentCompany: lead.currentCompany,
              currentTitle: lead.currentTitle,
              connectionDegree: lead.connectionDegree,
              connectionCount: lead.connectionCount,
              tags: lead.tags,
              scrapedAt: new Date().toISOString(),
            },
          },
        },
      });

      imported++;
    } catch (error) {
      errors.push({
        lead,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { imported, duplicates, errors };
}

export default router;
