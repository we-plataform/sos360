import { Router } from 'express';
import { prisma } from '@lia360/database';
import { z } from 'zod';
import {
  createCloudBrowserSessionSchema,
  createCloudBrowserTaskSchema,
  listCloudBrowserSessionsSchema,
  listCloudBrowserTasksSchema,
} from '@lia360/shared';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../lib/errors.js';
import type { Server } from 'socket.io';
import {
  createSession,
  createTask,
  pollTaskStatus,
  handleTaskResult,
  getActiveSessions,
  getSessionTasks,
  revokeSession,
  getUsageStats,
  scrapeLinkedInProfile,
  searchLinkedInLeads,
  sendLinkedInConnection,
} from '../services/cloud-browser.service.js';

export const cloudBrowserRouter = Router();

// All routes require authentication
cloudBrowserRouter.use(authenticate);

// POST /sessions - Create a new Cloud Browser session
cloudBrowserRouter.post(
  '/sessions',
  authorize('owner', 'admin', 'manager'),
  validate(createCloudBrowserSessionSchema),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { platform, connectorIds, metadata } = req.body;

      // Create session via service
      const session = await createSession(workspaceId, platform, connectorIds, metadata);

      // Emit socket event
      const io = req.app.get('io') as Server;
      io.to(`workspace:${workspaceId}`).emit('cloud-browser:session:created', session);

      res.status(201).json({
        success: true,
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /sessions - List all Cloud Browser sessions for workspace
cloudBrowserRouter.get(
  '/sessions',
  validate(listCloudBrowserSessionsSchema, 'query'),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { platform, status } = req.query as z.infer<typeof listCloudBrowserSessionsSchema>;

      // Build where clause
      const where: Record<string, unknown> = { workspaceId };

      if (platform) where.platform = platform;
      if (status) where.status = status;

      // Fetch sessions
      const sessions = await prisma.cloudBrowserSession.findMany({
        where,
        include: {
          _count: {
            select: { tasks: true },
          },
        },
        orderBy: { lastUsedAt: 'desc' },
      });

      res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /sessions/:id - Get a specific Cloud Browser session
cloudBrowserRouter.get('/sessions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    const session = await prisma.cloudBrowserSession.findFirst({
      where: { id, workspaceId },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!session) {
      throw new NotFoundError('Cloud Browser session');
    }

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /sessions/:id - Revoke a Cloud Browser session
cloudBrowserRouter.delete(
  '/sessions/:id',
  authorize('owner', 'admin', 'manager'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;

      // Revoke session via service
      const session = await revokeSession(id, workspaceId);

      // Emit socket event
      const io = req.app.get('io') as Server;
      io.to(`workspace:${workspaceId}`).emit('cloud-browser:session:revoked', session);

      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /tasks - Create a new Cloud Browser task
cloudBrowserRouter.post(
  '/tasks',
  authorize('owner', 'admin', 'manager', 'agent'),
  validate(createCloudBrowserTaskSchema),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { sessionId, prompt, metadata } = req.body;

      // Verify session belongs to workspace
      const session = await prisma.cloudBrowserSession.findFirst({
        where: { id: sessionId, workspaceId },
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Cloud Browser session not found or access denied',
        });
      }

      // Create task via service
      const task = await createTask(sessionId, prompt, metadata);

      // Emit socket event
      const io = req.app.get('io') as Server;
      io.to(`workspace:${workspaceId}`).emit('cloud-browser:task:created', task);

      res.status(201).json({
        success: true,
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /tasks/:id - Get task status and result
cloudBrowserRouter.get('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    // Fetch task with session to verify workspace access
    const task = await prisma.cloudBrowserTask.findUnique({
      where: { id },
      include: { session: true },
    });

    if (!task) {
      throw new NotFoundError('Cloud Browser task');
    }

    // Verify workspace access
    if (task.session.workspaceId !== workspaceId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this task',
      });
    }

    // Poll for latest status
    const updatedTask = await pollTaskStatus(id);

    res.json({
      success: true,
      data: updatedTask,
    });
  } catch (error) {
    next(error);
  }
});

// GET /tasks/:id/result - Get task result (only available for completed tasks)
cloudBrowserRouter.get('/tasks/:id/result', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    // Fetch task with session to verify workspace access
    const taskWithSession = await prisma.cloudBrowserTask.findUnique({
      where: { id },
      include: { session: true },
    });

    if (!taskWithSession) {
      throw new NotFoundError('Cloud Browser task');
    }

    // Verify workspace access
    if (taskWithSession.session.workspaceId !== workspaceId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this task',
      });
    }

    // Handle task result via service
    const { result, task } = await handleTaskResult(id);

    res.json({
      success: true,
      data: {
        result,
        taskId: task.id,
        status: task.status,
        cost: task.cost,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /sessions/:id/tasks - List tasks for a session
cloudBrowserRouter.get(
  '/sessions/:id/tasks',
  validate(listCloudBrowserTasksSchema, 'query'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;
      const { status } = req.query as z.infer<typeof listCloudBrowserTasksSchema>;

      // Verify session belongs to workspace
      const session = await prisma.cloudBrowserSession.findFirst({
        where: { id, workspaceId },
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Cloud Browser session not found or access denied',
        });
      }

      // Get tasks via service
      const tasks = await getSessionTasks(id, status as any);

      res.json({
        success: true,
        data: tasks,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /usage - Get usage statistics for workspace
cloudBrowserRouter.get('/usage', async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const { startDate, endDate } = req.query;

    // Parse dates if provided
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    // Get usage stats via service
    const stats = await getUsageStats(workspaceId, start, end);

    // Get active sessions count
    const activeSessions = await getActiveSessions(workspaceId);

    res.json({
      success: true,
      data: {
        ...stats,
        activeSessions: activeSessions.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// LinkedIn-specific automation routes (Skyvern)
// ============================================================================

// POST /linkedin/scrape - Scrape a LinkedIn profile
cloudBrowserRouter.post(
  '/linkedin/scrape',
  authorize('owner', 'admin', 'manager', 'agent'),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { sessionId, profileUrl } = req.body;

      if (!sessionId || !profileUrl) {
        return res.status(400).json({
          success: false,
          error: 'sessionId and profileUrl are required',
        });
      }

      // Verify session belongs to workspace
      const session = await prisma.cloudBrowserSession.findFirst({
        where: { id: sessionId, workspaceId },
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Cloud Browser session not found or access denied',
        });
      }

      // Create scraping task via Skyvern
      const task = await scrapeLinkedInProfile(sessionId, profileUrl);

      // Emit socket event
      const io = req.app.get('io') as Server;
      io.to(`workspace:${workspaceId}`).emit('cloud-browser:linkedin:scrape:started', {
        taskId: task.id,
        profileUrl,
      });

      res.status(201).json({
        success: true,
        data: {
          taskId: task.id,
          status: task.status,
          profileUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /linkedin/search - Search for leads on LinkedIn
cloudBrowserRouter.post(
  '/linkedin/search',
  authorize('owner', 'admin', 'manager', 'agent'),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { sessionId, searchQuery, maxResults = 10 } = req.body;

      if (!sessionId || !searchQuery) {
        return res.status(400).json({
          success: false,
          error: 'sessionId and searchQuery are required',
        });
      }

      // Verify session belongs to workspace
      const session = await prisma.cloudBrowserSession.findFirst({
        where: { id: sessionId, workspaceId },
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Cloud Browser session not found or access denied',
        });
      }

      // Create search task via Skyvern
      const task = await searchLinkedInLeads(sessionId, searchQuery, maxResults);

      // Emit socket event
      const io = req.app.get('io') as Server;
      io.to(`workspace:${workspaceId}`).emit('cloud-browser:linkedin:search:started', {
        taskId: task.id,
        searchQuery,
        maxResults,
      });

      res.status(201).json({
        success: true,
        data: {
          taskId: task.id,
          status: task.status,
          searchQuery,
          maxResults,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /linkedin/connect - Send a connection request
cloudBrowserRouter.post(
  '/linkedin/connect',
  authorize('owner', 'admin', 'manager', 'agent'),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { sessionId, profileUrl, note } = req.body;

      if (!sessionId || !profileUrl) {
        return res.status(400).json({
          success: false,
          error: 'sessionId and profileUrl are required',
        });
      }

      // Verify session belongs to workspace
      const session = await prisma.cloudBrowserSession.findFirst({
        where: { id: sessionId, workspaceId },
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Cloud Browser session not found or access denied',
        });
      }

      // Create connection task via Skyvern
      const task = await sendLinkedInConnection(sessionId, profileUrl, note);

      // Emit socket event
      const io = req.app.get('io') as Server;
      io.to(`workspace:${workspaceId}`).emit('cloud-browser:linkedin:connect:started', {
        taskId: task.id,
        profileUrl,
      });

      res.status(201).json({
        success: true,
        data: {
          taskId: task.id,
          status: task.status,
          profileUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);
