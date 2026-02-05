import type { Browser, BrowserContext } from 'puppeteer';
import { logger } from './logger.js';
import { AppError } from './errors.js';
import { launchStealthBrowser } from './stealth-config.js';

/**
 * Configuration options for the browser pool
 */
export interface BrowserPoolConfig {
  /** Minimum number of contexts to maintain (default: 2) */
  minSize?: number;
  /** Maximum number of contexts allowed (default: 5) */
  maxSize?: number;
  /** Maximum pages per context before recycling (default: 20) */
  maxPagesPerContext?: number;
  /** Platform for stealth configuration (default: 'default') */
  platform?: string;
}

/**
 * Pooled context wrapper to track usage
 */
interface PooledContext {
  /** The browser context instance */
  context: BrowserContext;
  /** Number of pages created in this context */
  pageCount: number;
  /** Whether this context is currently in use */
  inUse: boolean;
  /** Timestamp when context was created */
  createdAt: number;
}

/**
 * Browser pool manager for efficient browser context reuse
 *
 * Manages a single browser instance with multiple contexts to avoid spin-up overhead
 * while preventing memory leaks through context recycling.
 *
 * @example
 * ```typescript
 * const pool = new BrowserPool({ minSize: 2, maxSize: 5 });
 * await pool.initialize();
 *
 * const context = await pool.acquire();
 * try {
 *   const page = await context.newPage();
 *   // ... use page
 * } finally {
 *   await pool.release(context);
 * }
 *
 * await pool.closeAll();
 * ```
 */
export class BrowserPool {
  private browser: Browser | null = null;
  private contexts: PooledContext[] = [];
  private config: Required<BrowserPoolConfig>;
  private isInitialized: boolean = false;
  private isClosing: boolean = false;

  // Default configuration
  private static readonly DEFAULT_CONFIG: Required<BrowserPoolConfig> = {
    minSize: 2,
    maxSize: 5,
    maxPagesPerContext: 20,
    platform: 'default',
  };

  /**
   * Create a new browser pool
   * @param config - Pool configuration options
   */
  constructor(config: BrowserPoolConfig = {}) {
    this.config = {
      ...BrowserPool.DEFAULT_CONFIG,
      ...config,
    };

    // Validate configuration
    if (this.config.minSize < 0) {
      throw new AppError(400, 'invalid_config', 'minSize must be >= 0');
    }
    if (this.config.maxSize < this.config.minSize) {
      throw new AppError(400, 'invalid_config', 'maxSize must be >= minSize');
    }
    if (this.config.maxPagesPerContext < 1) {
      throw new AppError(400, 'invalid_config', 'maxPagesPerContext must be >= 1');
    }

    logger.debug(
      `Browser pool created with config: min=${this.config.minSize}, max=${this.config.maxSize}, maxPages=${this.config.maxPagesPerContext}`
    );
  }

  /**
   * Initialize the browser pool and create minimum contexts
   * @throws Error if browser fails to launch
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Browser pool already initialized');
      return;
    }

    try {
      logger.info('Initializing browser pool...');

      // Launch browser with stealth configuration
      this.browser = await launchStealthBrowser();

      // Create minimum number of contexts
      const contextPromises = Array.from({ length: this.config.minSize }, () =>
        this.createContext()
      );

      this.contexts = await Promise.all(contextPromises);

      this.isInitialized = true;
      logger.info(`Browser pool initialized with ${this.contexts.length} contexts`);
    } catch (error) {
      logger.error('Failed to initialize browser pool:', error);
      throw new AppError(500, 'pool_init_failed', 'Failed to initialize browser pool');
    }
  }

  /**
   * Acquire a browser context from the pool
   * Creates a new context if none available and under max size
   * @returns Browser context ready to use
   * @throws Error if pool is at max capacity and all contexts are in use
   */
  async acquire(): Promise<BrowserContext> {
    if (!this.isInitialized) {
      throw new AppError(500, 'pool_not_initialized', 'Browser pool not initialized');
    }

    if (this.isClosing) {
      throw new AppError(503, 'pool_closing', 'Browser pool is closing');
    }

    // Try to find an available context
    let availableContext = this.contexts.find(ctx => !ctx.inUse);

    // If no available context and we're under max size, create a new one
    if (!availableContext && this.contexts.length < this.config.maxSize) {
      logger.debug(`Creating new context (${this.contexts.length + 1}/${this.config.maxSize})`);
      try {
        availableContext = await this.createContext();
        this.contexts.push(availableContext);
      } catch (error) {
        logger.error('Failed to create new context:', error);
        throw new AppError(500, 'context_creation_failed', 'Failed to create browser context');
      }
    }

    // If still no available context, wait briefly and retry (once)
    if (!availableContext) {
      logger.debug('No contexts available, waiting briefly...');
      await this.sleep(100);

      availableContext = this.contexts.find(ctx => !ctx.inUse);
    }

    // If still no context available, pool is exhausted
    if (!availableContext) {
      throw new AppError(
        503,
        'pool_exhausted',
        `All ${this.config.maxSize} browser contexts are in use. Please retry later.`
      );
    }

    // Mark context as in use
    availableContext.inUse = true;

    // Check if context needs recycling
    if (availableContext.pageCount >= this.config.maxPagesPerContext) {
      logger.debug(`Recycling context with ${availableContext.pageCount} pages`);
      await this.recycleContext(availableContext);
    }

    logger.debug(
      `Acquired context (${this.contexts.filter(c => c.inUse).length}/${this.contexts.length} in use)`
    );

    return availableContext.context;
  }

  /**
   * Release a browser context back to the pool
   * @param context - Browser context to release
   */
  async release(context: BrowserContext): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Attempting to release context from uninitialized pool');
      return;
    }

    const pooledContext = this.contexts.find(ctx => ctx.context === context);

    if (!pooledContext) {
      logger.warn('Attempting to release context that is not managed by this pool');
      return;
    }

    if (!pooledContext.inUse) {
      logger.warn('Attempting to release context that is not in use');
      return;
    }

    // Mark as available
    pooledContext.inUse = false;

    logger.debug(
      `Released context (${this.contexts.filter(c => c.inUse).length}/${this.contexts.length} in use)`
    );

    // Close excess contexts if we're above min size
    if (this.contexts.length > this.config.minSize) {
      const excessContexts = this.contexts.filter(ctx => !ctx.inUse);
      const toClose = excessContexts.slice(0, this.contexts.length - this.config.minSize);

      for (const ctx of toClose) {
        await this.closeContext(ctx);
      }
    }
  }

  /**
   * Close all browser contexts and the browser instance
   * Should be called when shutting down the application
   */
  async closeAll(): Promise<void> {
    if (this.isClosing) {
      logger.warn('Browser pool is already closing');
      return;
    }

    this.isClosing = true;
    logger.info('Closing browser pool...');

    // Close all contexts
    const closePromises = this.contexts.map(ctx => this.closeContext(ctx));
    await Promise.allSettled(closePromises);

    this.contexts = [];

    // Close browser
    if (this.browser && this.browser.isConnected()) {
      try {
        await this.browser.close();
        logger.info('Browser closed');
      } catch (error) {
        logger.error('Error closing browser:', error);
      }
    }

    this.browser = null;
    this.isInitialized = false;
    this.isClosing = false;

    logger.info('Browser pool closed');
  }

  /**
   * Get current pool statistics
   * @returns Pool statistics
   */
  getStats(): {
    totalContexts: number;
    inUseContexts: number;
    availableContexts: number;
    isInitialized: boolean;
  } {
    return {
      totalContexts: this.contexts.length,
      inUseContexts: this.contexts.filter(ctx => ctx.inUse).length,
      availableContexts: this.contexts.filter(ctx => !ctx.inUse).length,
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Create a new browser context
   * @returns Pooled context wrapper
   * @throws Error if context creation fails
   */
  private async createContext(): Promise<PooledContext> {
    if (!this.browser) {
      throw new AppError(500, 'browser_not_available', 'Browser not available');
    }

    try {
      const context = await this.browser.createBrowserContext();

      const pooledContext: PooledContext = {
        context,
        pageCount: 0,
        inUse: false,
        createdAt: Date.now(),
      };

      logger.debug('Created new browser context');
      return pooledContext;
    } catch (error) {
      logger.error('Failed to create browser context:', error);
      throw new AppError(500, 'context_creation_failed', 'Failed to create browser context');
    }
  }

  /**
   * Recycle a context by closing and creating a new one
   * @param pooledContext - Context to recycle
   */
  private async recycleContext(pooledContext: PooledContext): Promise<void> {
    try {
      // Close old context
      await pooledContext.context.close();
      logger.debug('Recycled old context (closed after max pages)');

      // Create new context
      const newContext = await this.createContext();

      // Replace in array (maintain position)
      const index = this.contexts.indexOf(pooledContext);
      if (index !== -1) {
        this.contexts[index] = newContext;
      }
    } catch (error) {
      logger.error('Failed to recycle context:', error);
      throw new AppError(500, 'context_recycle_failed', 'Failed to recycle browser context');
    }
  }

  /**
   * Close a single context
   * @param pooledContext - Context to close
   */
  private async closeContext(pooledContext: PooledContext): Promise<void> {
    try {
      if (pooledContext.context) {
        await pooledContext.context.close();
      }
    } catch (error) {
      logger.warn('Error closing context:', error);
    } finally {
      // Remove from array
      const index = this.contexts.indexOf(pooledContext);
      if (index !== -1) {
        this.contexts.splice(index, 1);
      }
    }
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Singleton browser pool instance
 * Use this for a shared pool across the application
 */
let globalPool: BrowserPool | null = null;

/**
 * Get or create the global browser pool instance
 * @param config - Pool configuration (only used on first call)
 * @returns Global browser pool instance
 */
export function getGlobalBrowserPool(config?: BrowserPoolConfig): BrowserPool {
  if (!globalPool) {
    globalPool = new BrowserPool(config);
  }
  return globalPool;
}

/**
 * Close the global browser pool
 * Call this during application shutdown
 */
export async function closeGlobalBrowserPool(): Promise<void> {
  if (globalPool) {
    await globalPool.closeAll();
    globalPool = null;
  }
}
