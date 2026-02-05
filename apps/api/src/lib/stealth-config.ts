import type { LaunchOptions, Browser, Page } from 'puppeteer';

// Dynamic import with proper typing
let puppeteer: {
  launch(options: LaunchOptions): Promise<Browser>;
} | null = null;

/**
 * Array of realistic user agents to randomize browser fingerprints
 * Updated as of 2024 to avoid detection
 */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
];

/**
 * Viewport configurations to simulate different devices
 */
const VIEWPORTS = [
  { width: 1920, height: 1080, deviceScaleFactor: 1 },
  { width: 1440, height: 900, deviceScaleFactor: 1 },
  { width: 1366, height: 768, deviceScaleFactor: 1 },
  { width: 1536, height: 864, deviceScaleFactor: 1.25 },
  { width: 1280, height: 720, deviceScaleFactor: 1 },
];

/**
 * Randomly select an item from an array
 */
function randomSelect<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate random delay to simulate human behavior
 */
export function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get a random user agent string
 */
export function getRandomUserAgent(): string {
  return randomSelect(USER_AGENTS);
}

/**
 * Get a random viewport configuration
 */
export function getRandomViewport(): { width: number; height: number; deviceScaleFactor: number } {
  return randomSelect(VIEWPORTS);
}

/**
 * Stealth launch options configured for anti-detection
 * These settings help evade bot detection systems
 */
export const stealthLaunchOptions: LaunchOptions = {
  headless: true,
  args: [
    // Disable automation indicators
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-site-isolation-trials',
    // Window size
    '--window-size=1920,1080',
    // Language
    '--lang=en-US,en',
    // User agent (will be randomized per session)
    `--user-agent=${getRandomUserAgent()}`,
    // GPU acceleration
    '--disable-gpu',
    '--disable-software-rasterizer',
    // Disable infobars
    '--disable-infobars',
    // Disable extensions
    '--disable-extensions',
    // Disable background thread
    '--disable-backgrounding-occluded-windows',
    // Disable renderer backgrounding
    '--disable-renderer-backgrounding',
    // Mock device permissions
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
  ],
  defaultViewport: getRandomViewport(),
  ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdNavigation'],
};

/**
 * Enhanced stealth options for high-risk detection scenarios
 * Use these for platforms with aggressive bot detection (e.g., LinkedIn)
 */
export const enhancedStealthOptions: LaunchOptions = {
  ...stealthLaunchOptions,
  args: [
    ...(stealthLaunchOptions.args || []),
    '--disable-features=VizDisplayCompositor',
    '--disable-ipc-flooding-protection',
    '--disable-features=site-per-process',
    '--disable-features=CrossSiteDocumentBlockingIfIsolating',
    '--disable-features=CrossSiteDocumentBlockingAlways',
    '--disable-webgl',
    '--disable-features=IsolateOrigins,site-per-process',
  ],
};

/**
 * Initialize puppeteer with stealth plugin
 * This should be called once at application startup
 */
export async function initializePuppeteer(): Promise<void> {
  try {
    const puppeteerExtra = await import('puppeteer-extra');
    const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;

    // Use any to bypass complex type definitions
    (puppeteerExtra.default as any).use(StealthPlugin());

    puppeteer = puppeteerExtra.default as unknown as {
      launch(options: LaunchOptions): Promise<Browser>;
    };
  } catch (error) {
    throw new Error('Failed to initialize puppeteer-extra. Ensure dependencies are installed: puppeteer-extra puppeteer-extra-plugin-stealth');
  }
}

/**
 * Launch browser with stealth configuration
 * Applies additional anti-detection measures at runtime
 */
export async function launchStealthBrowser(
  options: LaunchOptions = stealthLaunchOptions
): Promise<Browser> {
  if (!puppeteer) {
    await initializePuppeteer();
  }

  if (!puppeteer) {
    throw new Error('Puppeteer initialization failed');
  }

  const browser = await puppeteer.launch(options);

  // Apply additional stealth measures to all pages
  browser.on('targetcreated', async (target) => {
    if (target.type() === 'page') {
      const page = await target.page();
      if (page) {
        await applyStealthToPage(page);
      }
    }
  });

  return browser;
}

/**
 * Apply runtime stealth measures to a page
 * These scripts run in the browser context to hide automation
 */
async function applyStealthToPage(page: Page): Promise<void> {
  // Override navigator.webdriver and other properties
  await page.evaluateOnNewDocument(`
    // Override navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Override navigator.plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Override navigator.languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    // Mock chrome object
    window.chrome = {
      runtime: {},
    };

    // Mock permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'granted' })
        : originalQuery(parameters)
    );
  `);
}

/**
 * Stealth configuration for different platforms
 * Platforms may require different levels of stealth
 */
export const platformStealthConfig = {
  linkedin: enhancedStealthOptions,
  instagram: stealthLaunchOptions,
  facebook: enhancedStealthOptions,
  twitter: stealthLaunchOptions,
  x: stealthLaunchOptions,
  default: stealthLaunchOptions,
} as const;

/**
 * Get platform-specific stealth configuration
 */
export function getStealthConfigForPlatform(
  platform: string = 'default'
): LaunchOptions {
  return platformStealthConfig[platform as keyof typeof platformStealthConfig] || stealthLaunchOptions;
}

/**
 * Get puppeteer instance (initialized with stealth plugin)
 */
export async function getPuppeteer() {
  if (!puppeteer) {
    await initializePuppeteer();
  }
  return puppeteer;
}
