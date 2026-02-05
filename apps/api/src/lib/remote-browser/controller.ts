/**
 * Remote Browser Controller
 * Allows Chrome extension to control Puppeteer browser via API
 * Similar to Playwright Browser Service
 */

import type { Page, Browser } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger.js';
import { getSessionManager } from './session-manager.js';
import type { BrowserSession } from './session-manager.js';

/**
 * Navigation command
 */
export interface NavigateCommand {
  action: 'navigate';
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
}

/**
 * Extract content command
 */
export interface ExtractCommand {
  action: 'extract';
  selector?: string;
  extractType: 'html' | 'text' | 'screenshot' | 'pdf';
  options?: any;
}

/**
 * Evaluate command
 */
export interface EvaluateCommand {
  action: 'evaluate';
  script: string;
}

/**
 * Click command
 */
export interface ClickCommand {
  action: 'click';
  selector: string;
}

/**
 * Scroll command
 */
export interface ScrollCommand {
  action: 'scroll';
  distance?: number;
  targetPosition?: number;
}

/**
 * Type command
 */
export interface TypeCommand {
  action: 'type';
  selector: string;
  text: string;
}

/**
 * Wait command
 */
export interface WaitCommand {
  action: 'wait';
  condition?: 'selector' | 'time' | 'navigation';
  value?: any;
}

/**
 * Command types
 */
export type BrowserCommand =
  | NavigateCommand
  | ExtractCommand
  | EvaluateCommand
  | ClickCommand
  | ScrollCommand
  | TypeCommand
  | WaitCommand;

/**
 * Command result
 */
export interface CommandResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
}

/**
 * Remote Browser Session
 */
export interface RemoteBrowserSession {
  sessionId: string;
  workspaceId: string;
  status: 'active' | 'idle' | 'closed';
  currentUrl?: string;
  createdAt: Date;
  lastUsedAt: Date;
}

/**
 * Remote Browser Controller
 * Manages Puppeteer browser for Chrome extension control
 */
export class RemoteBrowserController {
  private sessions: Map<string, RemoteBrowserSession> = new Map();
  private browserSessions: Map<string, BrowserSession> = new Map();
  private pages: Map<string, Page> = new Map();

  /**
   * Create a new remote browser session for extension
   */
  async createSession(workspaceId: string): Promise<RemoteBrowserSession> {
    logger.info({ workspaceId }, 'Creating remote browser session for extension');

    const sessionManager = getSessionManager();
    const browserSession = await sessionManager.acquire(workspaceId);
    const page = await sessionManager.getPage(browserSession.id);

    const sessionId = uuidv4();

    const remoteSession: RemoteBrowserSession = {
      sessionId,
      workspaceId,
      status: 'active',
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    this.sessions.set(sessionId, remoteSession);
    this.browserSessions.set(sessionId, browserSession);
    this.pages.set(sessionId, page);

    logger.info({ sessionId, workspaceId }, 'Remote browser session created');

    return remoteSession;
  }

  /**
   * Execute command in remote browser
   */
  async executeCommand(
    sessionId: string,
    command: BrowserCommand
  ): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      const remoteSession = this.sessions.get(sessionId);
      if (!remoteSession) {
        return {
          success: false,
          error: 'Session not found',
          executionTime: Date.now() - startTime,
        };
      }

      const page = this.pages.get(sessionId);
      if (!page) {
        return {
          success: false,
          error: 'Page not found',
          executionTime: Date.now() - startTime,
        };
      }

      // Update last used time
      remoteSession.lastUsedAt = new Date();

      // Execute command
      const data = await this.executeCommandOnPage(page, command);

      // Update current URL if navigation command
      if (command.action === 'navigate' && data.success) {
        remoteSession.currentUrl = command.url;
      }

      return {
        success: true,
        data,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error({ error, sessionId, command }, 'Command execution failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute command on page
   */
  private async executeCommandOnPage(page: Page, command: BrowserCommand): Promise<any> {
    switch (command.action) {
      case 'navigate': {
        const navCmd = command as NavigateCommand;
        await page.goto(command.url, {
          waitUntil: command.waitUntil || 'networkidle2',
          timeout: command.timeout || 30000,
        });
        return { url: page.url(), title: await page.title() };
      }

      case 'extract': {
        const extCmd = command as ExtractCommand;

        if (extCmd.extractType === 'html') {
          if (extCmd.selector) {
            const element = await page.$(extCmd.selector);
            if (!element) {
              throw new Error(`Element not found: ${extCmd.selector}`);
            }
            return await element.evaluate((el: any) => el.outerHTML);
          } else {
            return await page.content();
          }
        }

        if (extCmd.extractType === 'text') {
          if (extCmd.selector) {
            const element = await page.$(extCmd.selector);
            if (!element) {
              throw new Error(`Element not found: ${extCmd.selector}`);
            }
            return await element.evaluate((el: any) => el.textContent);
          } else {
            return await page.evaluate(() => document.body.innerText);
          }
        }

        if (extCmd.extractType === 'screenshot') {
          const screenshot = await page.screenshot(extCmd.options || {});
          return screenshot.toString('base64');
        }

        if (extCmd.extractType === 'pdf') {
          const pdf = await page.pdf(extCmd.options || {});
          return pdf.toString('base64');
        }

        throw new Error(`Unsupported extract type: ${extCmd.extractType}`);
      }

      case 'evaluate': {
        const evalCmd = command as EvaluateCommand;
        return await page.evaluate(evalCmd.script);
      }

      case 'click': {
        const clickCmd = command as ClickCommand;
        await page.click(clickCmd.selector);
        return { clicked: true };
      }

      case 'scroll': {
        const scrollCmd = command as ScrollCommand;

        if (scrollCmd.targetPosition !== undefined) {
          await page.evaluate((pos) => {
            window.scrollTo({ top: pos, behavior: 'smooth' });
          }, scrollCmd.targetPosition);
        } else {
          const distance = scrollCmd.distance || 500;
          await page.evaluate((dist) => {
            window.scrollBy({ top: dist, behavior: 'smooth' });
          }, distance);
        }

        // Wait for scroll to complete
        await page.waitForTimeout(1000);

        return { scrolled: true, scrollPosition: await page.evaluate(() => window.scrollY) };
      }

      case 'type': {
        const typeCmd = command as TypeCommand;
        await page.type(typeCmd.selector, typeCmd.text);
        return { typed: true };
      }

      case 'wait': {
        const waitCmd = command as WaitCommand;

        if (waitCmd.condition === 'selector') {
          await page.waitForSelector(waitCmd.value, { timeout: 10000 });
        } else if (waitCmd.condition === 'time') {
          await page.waitForTimeout(waitCmd.value);
        } else if (waitCmd.condition === 'navigation') {
          await page.waitForNavigation({ timeout: 15000 });
        } else {
          await page.waitForTimeout(waitCmd.value || 1000);
        }

        return { waited: true };
      }

      default:
        throw new Error(`Unknown command: ${(command as any).action}`);
    }
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): RemoteBrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all active sessions
   */
  listSessions(workspaceId?: string): RemoteBrowserSession[] {
    const sessions = Array.from(this.sessions.values());

    if (workspaceId) {
      return sessions.filter(s => s.workspaceId === workspaceId);
    }

    return sessions;
  }

  /**
   * Close session
   */
  async closeSession(sessionId: string): Promise<boolean> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return false;
      }

      // Close page
      const page = this.pages.get(sessionId);
      if (page) {
        await page.close();
        this.pages.delete(sessionId);
      }

      // Release browser session
      const browserSession = this.browserSessions.get(sessionId);
      if (browserSession) {
        const sessionManager = getSessionManager();
        await sessionManager.release(browserSession);
        this.browserSessions.delete(sessionId);
      }

      this.sessions.delete(sessionId);
      session.status = 'closed';

      logger.info({ sessionId }, 'Remote browser session closed');
      return true;
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to close session');
      return false;
    }
  }

  /**
   * Clean up idle sessions
   */
  async cleanupIdleSessions(maxIdleTime: number = 30 * 60 * 1000): Promise<void> {
    const now = Date.now();
    const sessionsToClose: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const idleTime = now - session.lastUsedAt.getTime();

      if (session.status === 'active' && idleTime > maxIdleTime) {
        sessionsToClose.push(sessionId);
      }
    }

    for (const sessionId of sessionsToClose) {
      await this.closeSession(sessionId);
    }

    if (sessionsToClose.length > 0) {
      logger.info(
        { closedSessions: sessionsToClose.length },
        'Cleaned up idle remote browser sessions'
      );
    }
  }
}

// Global controller instance
let globalController: RemoteBrowserController | null = null;

/**
 * Get or create the global remote browser controller
 */
export function getRemoteBrowserController(): RemoteBrowserController {
  if (!globalController) {
    globalController = new RemoteBrowserController();

    // Start cleanup interval (every 5 minutes)
    setInterval(() => {
      globalController?.cleanupIdleSessions();
    }, 5 * 60 * 1000);
  }
  return globalController;
}
