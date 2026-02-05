import { prisma, CloudBrowserSession, CloudBrowserTask, SessionStatus, TaskStatus, Prisma } from '@lia360/database';
import { logger } from '../lib/logger.js';

/**
 * Skyvern Self-Hosted API configuration
 * 
 * Skyvern is an open-source AI agent for browser automation using LLMs and computer vision.
 * Self-hosted instance should be deployed via Docker Compose.
 * 
 * @see https://docs.skyvern.com
 */
const SKYVERN_API_URL = process.env.SKYVERN_API_URL || 'http://localhost:8000';
const SKYVERN_API_KEY = process.env.SKYVERN_API_KEY;

// unused type removed

type SkyvernTaskStatus = 'created' | 'running' | 'completed' | 'failed' | 'cancelled' | 'queued' | 'terminated';

/**
 * Skyvern task response
 */

/**
 * Skyvern task response
 */
/**
 * Skyvern task response
 */
interface SkyvernTaskResponse {
  task_id: string; // Changed from run_id
  status: SkyvernTaskStatus;
  created_at: string;
  modified_at: string;
  run_type?: string;
  extracted_information?: Record<string, unknown>; // Changed from output
  downloaded_files?: Array<{ url: string; filename: string }>;
  recording_url?: string;
  screenshot_url?: string;
  failure_reason?: string;
  queued_at?: string;
  started_at?: string;
  finished_at?: string;
  app_url?: string;
  browser_session_id?: string;
  step_count?: number;
  errors?: Array<Record<string, unknown>>;
}

/**
 * Skyvern browser session response
 */
interface SkyvernSessionResponse {
  browser_session_id: string;
  status: string;
  created_at: string;
}

/**
 * Map Skyvern status to internal TaskStatus
 */
function mapSkyvernStatus(skyvernStatus: SkyvernTaskStatus): TaskStatus {
  switch (skyvernStatus) {
    case 'created':
    case 'queued':
      return TaskStatus.pending;
    case 'running':
      return TaskStatus.running;
    case 'completed':
      return TaskStatus.completed;
    case 'failed':
    case 'terminated':
      return TaskStatus.failed;
    case 'cancelled':
      return TaskStatus.cancelled;
    default:
      return TaskStatus.pending;
  }
}

/**
 * Create a new Cloud Browser session via Skyvern
 *
 * @param workspaceId - The workspace ID to associate with the session
 * @param platform - The platform for the session (linkedin, instagram, facebook, twitter)
 * @param metadata - Optional metadata for the session
 * @returns The created Cloud Browser session
 */
export async function createSession(
  workspaceId: string,
  platform: string,
  _connectorIds?: string[], // Unused
  _metadata?: Record<string, unknown> // Unused
): Promise<CloudBrowserSession> {
  try {
    // Verify API key is configured
    if (!SKYVERN_API_KEY) {
      throw new Error('SKYVERN_API_KEY environment variable is not configured');
    }

    // Calculate session expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // For Skyvern self-hosted, we create a browser session
    // This persists browser state across multiple tasks
    // Fixed: Use /v1 prefix instead of /api/v1 for browser sessions
    const response = await fetch(`${SKYVERN_API_URL}/v1/browser_sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SKYVERN_API_KEY,
      },
      body: JSON.stringify({
        timeout_minutes: 1440, // 24 hours
        proxy_location: 'NONE', // No proxy for self-hosted
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ error: errorText, status: response.status }, 'Failed to create Skyvern browser session');
      throw new Error(`Skyvern API error: ${response.status} ${response.statusText}`);
    }

    const skyvernData = (await response.json()) as SkyvernSessionResponse;

    // Store session in database
    const session = await prisma.cloudBrowserSession.create({
      data: {
        workspaceId,
        platform,
        manusSessionId: skyvernData.browser_session_id, // Reusing field for Skyvern session ID
        status: SessionStatus.active,
        lastUsedAt: new Date(),
        expiresAt,
      },
    });

    logger.info({ sessionId: session.id, skyvernSessionId: skyvernData.browser_session_id, platform }, 'Cloud Browser session created via Skyvern');

    return session;
  } catch (error) {
    logger.error({ err: error, workspaceId, platform }, 'Failed to create Cloud Browser session');
    throw error;
  }
}

/**
 * Create a new Cloud Browser task via Skyvern
 *
 * @param sessionId - The Cloud Browser session ID  
 * @param prompt - The natural language prompt for the task
 * @param metadata - Optional metadata for the task
 * @returns The created Cloud Browser task
 */
export async function createTask(
  sessionId: string,
  prompt: string,
  metadata?: Record<string, unknown>
): Promise<CloudBrowserTask> {
  try {
    // Fetch session to verify it exists and is active
    const session = await prisma.cloudBrowserSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Cloud Browser session not found');
    }

    if (session.status !== SessionStatus.active) {
      throw new Error(`Cloud Browser session is not active (status: ${session.status})`);
    }

    // Check if session has expired
    if (session.expiresAt < new Date()) {
      await prisma.cloudBrowserSession.update({
        where: { id: sessionId },
        data: { status: SessionStatus.expired },
      });
      throw new Error('Cloud Browser session has expired');
    }

    // Verify API key is configured
    if (!SKYVERN_API_KEY) {
      throw new Error('SKYVERN_API_KEY environment variable is not configured');
    }

    // Prepare task request (self-hosted format - v2)
    // Fixed: Use API v2 format
    const taskRequest = {
      url: (metadata?.url as string) || 'https://www.google.com',
      user_prompt: prompt, // Changed from navigation_goal to user_prompt for v2
      browser_session_id: session.manusSessionId,
      max_steps_override: (metadata?.maxSteps as number) || 50,
      extracted_information_schema: metadata?.dataSchema ? metadata.dataSchema : undefined,
    };

    // Call Skyvern API to create task (self-hosted endpoint - v2)
    // Fixed: Use /api/v2 prefix
    const response = await fetch(`${SKYVERN_API_URL}/api/v2/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SKYVERN_API_KEY,
      },
      body: JSON.stringify(taskRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ error: errorText, status: response.status }, 'Failed to create Skyvern task');
      throw new Error(`Skyvern API error: ${response.status} ${response.statusText}`);
    }

    const skyvernData = (await response.json()) as SkyvernTaskResponse;

    // Store task in database
    const task = await prisma.cloudBrowserTask.create({
      data: {
        sessionId,
        manusTaskId: skyvernData.task_id, // Fixed: use task_id
        prompt,
        status: mapSkyvernStatus(skyvernData.status),
      },
    });

    // Update session lastUsedAt timestamp
    await prisma.cloudBrowserSession.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() },
    });

    logger.info({ taskId: task.id, skyvernTaskId: skyvernData.task_id, sessionId }, 'Cloud Browser task created via Skyvern');

    return task;
  } catch (error) {
    logger.error({ err: error, sessionId, prompt }, 'Failed to create Cloud Browser task');
    throw error;
  }
}

/**
 * Poll the status of a Cloud Browser task from Skyvern
 *
 * @param taskId - The Cloud Browser task ID
 * @returns The updated Cloud Browser task with latest status
 */
export async function pollTaskStatus(taskId: string): Promise<CloudBrowserTask> {
  try {
    // Fetch task from database
    const task = await prisma.cloudBrowserTask.findUnique({
      where: { id: taskId },
      include: { session: true },
    });

    if (!task) {
      throw new Error('Cloud Browser task not found');
    }

    // If task is already in a terminal state, return it
    if (task.status === TaskStatus.completed || task.status === TaskStatus.failed || task.status === TaskStatus.cancelled) {
      return task;
    }

    // Verify API key is configured
    if (!SKYVERN_API_KEY) {
      throw new Error('SKYVERN_API_KEY environment variable is not configured');
    }

    // Call Skyvern API to get task status (self-hosted endpoint)
    // Fixed: Use /api/v2 prefix matching creation
    const response = await fetch(`${SKYVERN_API_URL}/api/v2/tasks/${task.manusTaskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SKYVERN_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ error: errorText, status: response.status }, 'Failed to get Skyvern task status');
      throw new Error(`Skyvern API error: ${response.status} ${response.statusText}`);
    }

    const skyvernData = (await response.json()) as SkyvernTaskResponse;
    const newStatus = mapSkyvernStatus(skyvernData.status);
    const isTerminal = newStatus === TaskStatus.completed || newStatus === TaskStatus.failed || newStatus === TaskStatus.cancelled;

    // Update task in database
    const updatedTask = await prisma.cloudBrowserTask.update({
      where: { id: taskId },
      data: {
        status: newStatus,
        result: skyvernData.extracted_information ? skyvernData.extracted_information as Prisma.InputJsonValue : null,
        error: skyvernData.failure_reason || null,
        cost: skyvernData.step_count || null, // Use step count as cost proxy
        completedAt: isTerminal ? new Date() : null,
      },
    });

    logger.debug({ taskId, skyvernTaskId: task.manusTaskId, status: skyvernData.status }, 'Cloud Browser task status updated');

    return updatedTask;
  } catch (error) {
    logger.error({ err: error, taskId }, 'Failed to poll Cloud Browser task status');
    throw error;
  }
}

/**
 * Process the result of a completed Cloud Browser task
 *
 * @param taskId - The Cloud Browser task ID
 * @returns The processed task result
 */
export async function handleTaskResult(taskId: string): Promise<{ result: unknown; task: CloudBrowserTask }> {
  try {
    // Fetch task from database
    const task = await prisma.cloudBrowserTask.findUnique({
      where: { id: taskId },
      include: { session: true },
    });

    if (!task) {
      throw new Error('Cloud Browser task not found');
    }

    // If task is not completed yet, poll for latest status
    if (task.status !== TaskStatus.completed) {
      if (task.status === TaskStatus.failed || task.status === TaskStatus.cancelled) {
        throw new Error(`Task cannot be processed (status: ${task.status}, error: ${task.error || 'No error message'})`);
      }
      // Poll for updated status
      const updatedTask = await pollTaskStatus(taskId);
      if (updatedTask.status !== TaskStatus.completed) {
        throw new Error(`Task is not completed yet (status: ${updatedTask.status})`);
      }
      return { result: updatedTask.result, task: updatedTask };
    }

    logger.info({ taskId, session: task.session.platform }, 'Processing Cloud Browser task result');

    return { result: task.result, task };
  } catch (error) {
    logger.error({ err: error, taskId }, 'Failed to handle Cloud Browser task result');
    throw error;
  }
}

/**
 * Get all active sessions for a workspace
 */
export async function getActiveSessions(
  workspaceId: string,
  platform?: string
): Promise<CloudBrowserSession[]> {
  try {
    const where: Record<string, unknown> = {
      workspaceId,
      status: SessionStatus.active,
      expiresAt: { gte: new Date() },
    };

    if (platform) {
      where.platform = platform;
    }

    const sessions = await prisma.cloudBrowserSession.findMany({
      where,
      orderBy: { lastUsedAt: 'desc' },
    });

    return sessions;
  } catch (error) {
    logger.error({ err: error, workspaceId, platform }, 'Failed to get active sessions');
    throw error;
  }
}

/**
 * Get tasks for a session
 */
export async function getSessionTasks(
  sessionId: string,
  status?: TaskStatus,
  limit = 50
): Promise<CloudBrowserTask[]> {
  try {
    const where: Record<string, unknown> = { sessionId };

    if (status) {
      where.status = status;
    }

    const tasks = await prisma.cloudBrowserTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return tasks;
  } catch (error) {
    logger.error({ err: error, sessionId, status }, 'Failed to get session tasks');
    throw error;
  }
}

/**
 * Revoke a Cloud Browser session
 */
export async function revokeSession(sessionId: string, workspaceId: string): Promise<CloudBrowserSession> {
  try {
    const session = await prisma.cloudBrowserSession.findFirst({
      where: { id: sessionId, workspaceId },
    });

    if (!session) {
      throw new Error('Cloud Browser session not found or access denied');
    }

    // Try to close session in Skyvern if possible
    if (session.manusSessionId && SKYVERN_API_KEY) {
      try {
        // Fixed: Use /v1 prefix instead of /api/v1
        await fetch(`${SKYVERN_API_URL}/v1/browser_sessions/${session.manusSessionId}`, {
          method: 'DELETE',
          headers: {
            'x-api-key': SKYVERN_API_KEY,
          },
        });
      } catch (e) {
        logger.warn({ err: e, sessionId }, 'Failed to close Skyvern browser session');
      }
    }

    const updatedSession = await prisma.cloudBrowserSession.update({
      where: { id: sessionId },
      data: { status: SessionStatus.revoked },
    });

    logger.info({ sessionId, workspaceId }, 'Cloud Browser session revoked');

    return updatedSession;
  } catch (error) {
    logger.error({ err: error, sessionId, workspaceId }, 'Failed to revoke Cloud Browser session');
    throw error;
  }
}

/**
 * Get usage statistics for a workspace
 */
export async function getUsageStats(
  workspaceId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalCost: number;
  tasksByPlatform: Record<string, number>;
  costsByPlatform: Record<string, number>;
}> {
  try {
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const sessions = await prisma.cloudBrowserSession.findMany({
      where: { workspaceId },
      select: { id: true, platform: true },
    });

    const sessionIds = sessions.map((s) => s.id);

    const tasks = await prisma.cloudBrowserTask.findMany({
      where: {
        sessionId: { in: sessionIds },
        ...(startDate || endDate ? { createdAt: dateFilter } : {}),
      },
    });

    const completedTasks = tasks.filter((t) => t.status === TaskStatus.completed).length;
    const failedTasks = tasks.filter((t) => t.status === TaskStatus.failed).length;
    const totalCost = tasks.reduce((sum, t) => sum + (t.cost || 0), 0);

    const tasksByPlatform: Record<string, number> = {};
    const costsByPlatform: Record<string, number> = {};

    for (const session of sessions) {
      const sessionTasks = tasks.filter((t) => t.sessionId === session.id);
      tasksByPlatform[session.platform] = (tasksByPlatform[session.platform] || 0) + sessionTasks.length;
      costsByPlatform[session.platform] = (costsByPlatform[session.platform] || 0) +
        sessionTasks.reduce((sum, t) => sum + (t.cost || 0), 0);
    }

    return {
      totalTasks: tasks.length,
      completedTasks,
      failedTasks,
      totalCost,
      tasksByPlatform,
      costsByPlatform,
    };
  } catch (error) {
    logger.error({ err: error, workspaceId, startDate, endDate }, 'Failed to get usage statistics');
    throw error;
  }
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await prisma.cloudBrowserSession.updateMany({
      where: {
        status: SessionStatus.active,
        expiresAt: { lt: new Date() },
      },
      data: { status: SessionStatus.expired },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Expired Cloud Browser sessions cleaned up');
    }

    return result.count;
  } catch (error) {
    logger.error({ err: error }, 'Failed to clean up expired sessions');
    throw error;
  }
}

// ============================================================================
// LinkedIn-specific automation functions using Skyvern
// ============================================================================

/**
 * Navigate to a LinkedIn profile and extract data via Skyvern
 */
export async function scrapeLinkedInProfile(
  sessionId: string,
  profileUrl: string
): Promise<CloudBrowserTask> {
  const prompt = `
Navigate to ${profileUrl} and extract the following information from the LinkedIn profile:

1. Full name
2. Headline/title
3. Current company and position
4. Location
5. About/bio section
6. Number of connections/followers
7. Email (if visible in contact info)
8. Phone (if visible in contact info)
9. Recent work experience (last 3 positions)
10. Education (last 2 entries)
11. Top 5 skills

Return the data in a structured JSON format.
`.trim();

  const dataSchema = {
    type: 'object',
    properties: {
      fullName: { type: 'string' },
      headline: { type: 'string' },
      company: { type: 'string' },
      position: { type: 'string' },
      location: { type: 'string' },
      about: { type: 'string' },
      connectionCount: { type: 'number' },
      followerCount: { type: 'number' },
      email: { type: 'string' },
      phone: { type: 'string' },
      experience: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            company: { type: 'string' },
            duration: { type: 'string' },
          },
        },
      },
      education: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            school: { type: 'string' },
            degree: { type: 'string' },
          },
        },
      },
      skills: { type: 'array', items: { type: 'string' } },
    },
  };

  return createTask(sessionId, prompt, { url: profileUrl, dataSchema, maxSteps: 30 });
}

/**
 * Search for leads on LinkedIn via Skyvern
 */
export async function searchLinkedInLeads(
  sessionId: string,
  searchQuery: string,
  maxResults = 10
): Promise<CloudBrowserTask> {
  const prompt = `
Go to LinkedIn and search for people matching: "${searchQuery}"

Instructions:
1. Navigate to linkedin.com/search
2. Enter the search query in the search bar
3. Filter results to show only "People"
4. Scroll through results and collect up to ${maxResults} profile URLs
5. For each profile, extract: name, headline, profile URL, and location if visible

Return a JSON array of the leads found.
`.trim();

  const dataSchema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        fullName: { type: 'string' },
        headline: { type: 'string' },
        profileUrl: { type: 'string' },
        location: { type: 'string' },
      },
    },
  };

  return createTask(sessionId, prompt, { url: 'https://www.linkedin.com', dataSchema, maxSteps: 50 });
}

/**
 * Send a connection request on LinkedIn via Skyvern
 */
export async function sendLinkedInConnection(
  sessionId: string,
  profileUrl: string,
  note?: string
): Promise<CloudBrowserTask> {
  const prompt = note
    ? `
Navigate to ${profileUrl} and send a connection request with the following personalized note:

"${note}"

Make sure to:
1. Click the "Connect" button
2. If prompted, select "Add a note"
3. Enter the provided note
4. Click "Send invitation"
5. Confirm the connection was sent successfully
`.trim()
    : `
Navigate to ${profileUrl} and send a connection request.

Make sure to:
1. Click the "Connect" button
2. If asked about adding a note, skip it
3. Click "Send invitation"
4. Confirm the connection was sent successfully
`.trim();

  return createTask(sessionId, prompt, { url: profileUrl, maxSteps: 20 });
}
