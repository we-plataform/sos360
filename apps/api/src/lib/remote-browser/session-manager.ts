/**
 * Session Manager for Remote Browser
 * Manages Puppeteer browser instances and pages
 */

import puppeteer from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger.js';

/**
 * Browser session
 */
export interface BrowserSession {
  id: string;
  workspaceId: string;
  browser: puppeteer.Browser;
  status: 'active' | 'idle' | 'closed';
  createdAt: Date;
  lastUsedAt: Date;
}

/**
 * Session Manager
 * Manages pool of Puppeteer browsers
 */
class SessionManager {
  private sessions: Map<string, BrowserSession> = new Map();
  private pages: Map<string, puppeteer.Page> = new Map();
  private browser?: puppeteer.Browser;

  /**
   * Initialize browser
   */
  private async initializeBrowser(): Promise<puppeteer.Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    logger.info('Initializing Puppeteer browser for remote browser');

    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    logger.info('Puppeteer browser launched successfully');

    return this.browser;
  }

  /**
   * Acquire a browser session
   */
  async acquire(workspaceId: string): Promise<BrowserSession> {
    await this.initializeBrowser();

    const sessionId = uuidv4();
    const session: BrowserSession = {
      id: sessionId,
      workspaceId,
      browser: this.browser!,
      status: 'active',
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    this.sessions.set(sessionId, session);

    logger.info({ sessionId, workspaceId }, 'Browser session acquired');

    return session;
  }

  /**
   * Get or create a page for a session
   */
  async getPage(sessionId: string): Promise<puppeteer.Page> {
    let page = this.pages.get(sessionId);

    if (!page || page.isClosed()) {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      page = await session.browser.newPage();
      this.pages.set(sessionId, page);

      logger.info({ sessionId }, 'New page created for session');
    }

    return page;
  }

  /**
   * Release a browser session
   */
  async release(session: BrowserSession): Promise<void> {
    const page = this.pages.get(session.id);
    if (page && !page.isClosed()) {
      await page.close();
      this.pages.delete(session.id);
    }

    session.status = 'idle';
    session.lastUsedAt = new Date();

    logger.info({ sessionId: session.id }, 'Browser session released');
  }

  /**
   * Close a session completely
   */
  async close(sessionId: string): Promise<void> {
    const page = this.pages.get(sessionId);
    if (page && !page.isClosed()) {
      await page.close();
      this.pages.delete(sessionId);
    }

    this.sessions.delete(sessionId);

    logger.info({ sessionId }, 'Browser session closed');
  }

  /**
   * Get active sessions count
   */
  getActiveCount(): number {
    return this.sessions.size;
  }

  /**
   * Cleanup idle sessions
   */
  async cleanupIdleSessions(maxIdleTime: number = 30 * 60 * 1000): Promise<void> {
    const now = Date.now();
    const sessionsToClose: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const idleTime = now - session.lastUsedAt.getTime();

      if (session.status === 'idle' && idleTime > maxIdleTime) {
        sessionsToClose.push(sessionId);
      }
    }

    for (const sessionId of sessionsToClose) {
      await this.close(sessionId);
    }

    if (sessionsToClose.length > 0) {
      logger.info(
        { closedSessions: sessionsToClose.length },
        'Cleaned up idle browser sessions'
      );
    }
  }

  /**
   * Close all sessions and browser
   */
  async closeAll(): Promise<void> {
    logger.info('Closing all browser sessions');

    for (const [sessionId, page] of this.pages) {
      if (!page.isClosed()) {
        await page.close();
      }
    }

    this.pages.clear();

    if (this.browser && this.browser.isConnected()) {
      await this.browser.close();
    }

    this.sessions.clear();

    logger.info('All browser sessions closed');
  }
}

// Global session manager instance
let sessionManager: SessionManager | null = null;

/**
 * Get or create the global session manager
 */
export function getSessionManager(): SessionManager {
  if (!sessionManager) {
    sessionManager = new SessionManager();

    // Start cleanup interval (every 5 minutes)
    setInterval(() => {
      sessionManager?.cleanupIdleSessions();
    }, 5 * 60 * 1000);

    // Cleanup on process exit
    process.on('beforeExit', async () => {
      await sessionManager?.closeAll();
    });

    process.on('SIGINT', async () => {
      await sessionManager?.closeAll();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await sessionManager?.closeAll();
      process.exit(0);
    });
  }

  return sessionManager;
}
