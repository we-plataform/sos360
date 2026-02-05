/**
 * Remote Browser API Routes
 * Allows Chrome extension to control Puppeteer browser via API
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { getRemoteBrowserController } from '../lib/remote-browser/controller.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * POST /api/v1/remote-browser/session/create
 * Create a new remote browser session for extension
 */
router.post('/session/create', authenticate, async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;

    logger.info({ workspaceId }, 'Creating remote browser session');

    const controller = getRemoteBrowserController();
    const session = await controller.createSession(workspaceId);

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        status: session.status,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create remote browser session');
    next(error);
  }
});

/**
 * POST /api/v1/remote-browser/:sessionId/execute
 * Execute a command in the remote browser
 */
router.post('/:sessionId/execute', authenticate, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const workspaceId = req.user!.workspaceId;
    const command = req.body;

    logger.debug({ sessionId, workspaceId, command }, 'Executing remote browser command');

    // Verify session belongs to workspace
    const controller = getRemoteBrowserController();
    const session = controller.getSession(sessionId);

    if (!session || session.workspaceId !== workspaceId) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or access denied',
      });
    }

    // Execute command
    const result = await controller.executeCommand(sessionId, command);

    res.json(result);
  } catch (error) {
    logger.error({ error }, 'Failed to execute remote browser command');
    next(error);
  }
});

/**
 * GET /api/v1/remote-browser/sessions
 * List all remote browser sessions
 */
router.get('/sessions', authenticate, async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const controller = getRemoteBrowserController();

    const sessions = controller.listSessions(workspaceId);

    res.json({
      success: true,
      data: {
        sessions: sessions.map((s) => ({
          sessionId: s.sessionId,
          status: s.status,
          currentUrl: s.currentUrl,
          createdAt: s.createdAt,
          lastUsedAt: s.lastUsedAt,
        })),
        count: sessions.length,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list remote browser sessions');
    next(error);
  }
});

/**
 * GET /api/v1/remote-browser/:sessionId/status
 * Get session status
 */
router.get('/:sessionId/status', authenticate, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const workspaceId = req.user!.workspaceId;

    const controller = getRemoteBrowserController();
    const session = controller.getSession(sessionId);

    if (!session || session.workspaceId !== workspaceId) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or access denied',
      });
    }

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        status: session.status,
        currentUrl: session.currentUrl,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get session status');
    next(error);
  }
});

/**
 * DELETE /api/v1/remote-browser/:sessionId
 * Close a remote browser session
 */
router.delete('/:sessionId', authenticate, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const workspaceId = req.user!.workspaceId;

    // Verify session belongs to workspace
    const controller = getRemoteBrowserController();
    const session = controller.getSession(sessionId);

    if (!session || session.workspaceId !== workspaceId) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or access denied',
      });
    }

    const closed = await controller.closeSession(sessionId);

    res.json({
      success: closed,
      message: closed ? 'Session closed' : 'Session not found',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to close remote browser session');
    next(error);
  }
});

export default router;
