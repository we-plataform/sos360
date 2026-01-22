import type { Express } from 'express';
import { authRouter } from './auth.js';
import { companiesRouter } from './companies.js';
import { workspacesRouter } from './workspaces.js';
import { leadsRouter } from './leads.js';
import { pipelinesRouter } from './pipelines.js';
import { tagsRouter } from './tags.js';
import { conversationsRouter } from './conversations.js';
import { templatesRouter } from './templates.js';
import { automationsRouter } from './automations.js';
import { analyticsRouter } from './analytics.js';
import { usersRouter } from './users.js';
import { healthRouter } from './health.js';
import { audiencesRouter } from './audiences.js';
import { postsRouter } from './posts.js';
import { defaultRateLimit } from '../middleware/rate-limit.js';

export function setupRoutes(app: Express): void {
  // Health check routes (no rate limit for monitoring)
  app.use('/health', healthRouter);

  // Apply default rate limit to all API routes
  app.use('/api', defaultRateLimit);

  // Mount routers
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/companies', companiesRouter);
  app.use('/api/v1/workspaces', workspacesRouter);
  app.use('/api/v1/leads', leadsRouter);
  app.use('/api/v1/pipelines', pipelinesRouter);
  app.use('/api/v1/tags', tagsRouter);
  app.use('/api/v1/conversations', conversationsRouter);
  app.use('/api/v1/templates', templatesRouter);
  app.use('/api/v1/automations', automationsRouter);
  app.use('/api/v1/analytics', analyticsRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/audiences', audiencesRouter);
  app.use('/api/v1/posts', postsRouter);

  // 404 handler for API routes
  app.use('/api', (_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        type: 'not_found',
        title: 'Not Found',
        status: 404,
        detail: 'Endpoint não encontrado',
      },
    });
  });
}
