import type { Express } from 'express';
import { authRouter } from './auth.js';
import { leadsRouter } from './leads.js';
import { tagsRouter } from './tags.js';
import { conversationsRouter } from './conversations.js';
import { templatesRouter } from './templates.js';
import { analyticsRouter } from './analytics.js';
import { usersRouter } from './users.js';
import { defaultRateLimit } from '../middleware/rate-limit.js';

export function setupRoutes(app: Express): void {
  // Apply default rate limit to all API routes
  app.use('/api', defaultRateLimit);

  // Mount routers
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/leads', leadsRouter);
  app.use('/api/v1/tags', tagsRouter);
  app.use('/api/v1/conversations', conversationsRouter);
  app.use('/api/v1/templates', templatesRouter);
  app.use('/api/v1/analytics', analyticsRouter);
  app.use('/api/v1/users', usersRouter);

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
