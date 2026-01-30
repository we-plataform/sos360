import { type Page, type Locator } from '@playwright/test';

/**
 * Test data factories for E2E tests
 */

/**
 * Creates test user data for registration/login
 *
 * @param overrides - Optional properties to override
 * @returns Test user object
 *
 * @example
 * ```ts
 * const userData = createTestUserData({
 *   email: 'custom@example.com',
 * });
 * ```
 */
export function createTestUserData(overrides?: Partial<{
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  workspaceName: string;
}>) {
  const timestamp = Date.now();
  return {
    email: `test-user-${timestamp}@example.com`,
    password: 'TestPassword123!',
    fullName: `Test User ${timestamp}`,
    companyName: `Test Company ${timestamp}`,
    workspaceName: `Test Workspace ${timestamp}`,
    ...overrides,
  };
}

/**
 * Creates test lead data for lead creation tests
 *
 * @param overrides - Optional properties to override
 * @returns Test lead object
 */
export function createTestLeadData(overrides?: Partial<{
  name: string;
  email: string;
  linkedinProfileUrl: string;
  company: string;
  jobTitle: string;
  phone: string;
  notes: string;
}>) {
  const timestamp = Date.now();
  return {
    name: `Test Lead ${timestamp}`,
    email: `lead-${timestamp}@example.com`,
    linkedinProfileUrl: `https://linkedin.com/in/test-lead-${timestamp}`,
    company: 'Test Company',
    jobTitle: 'CEO',
    phone: '+1234567890',
    notes: 'Test lead notes',
    ...overrides,
  };
}

/**
 * Creates test pipeline data for pipeline creation tests
 *
 * @param overrides - Optional properties to override
 * @returns Test pipeline object
 */
export function createTestPipelineData(overrides?: Partial<{
  name: string;
  description: string;
  stages: Array<{ name: string; color?: string }>;
}>) {
  const timestamp = Date.now();
  return {
    name: `Test Pipeline ${timestamp}`,
    description: 'Test pipeline description',
    stages: [
      { name: 'New', color: '#3B82F6' },
      { name: 'Contacted', color: '#F59E0B' },
      { name: 'Qualified', color: '#10B981' },
      { name: 'Closed', color: '#6366F1' },
    ],
    ...overrides,
  };
}

/**
 * Creates test audience data for audience creation tests
 *
 * @param overrides - Optional properties to override
 * @returns Test audience object
 */
export function createTestAudienceData(overrides?: Partial<{
  name: string;
  description: string;
  rules: {
    jobTitles?: { target: string[]; exclude: string[] };
    companies?: { industries: string[]; sizes: string[] };
  };
}>) {
  const timestamp = Date.now();
  return {
    name: `Test Audience ${timestamp}`,
    description: 'Test audience description',
    rules: {
      jobTitles: { target: ['CEO', 'CTO'], exclude: [] },
      companies: { industries: ['SaaS', 'Technology'], sizes: [] },
    },
    ...overrides,
  };
}

/**
 * Creates test CSV data for lead import tests
 *
 * @param count - Number of leads to generate
 * @returns CSV string with test lead data
 */
export function createTestCSVData(count: number = 5): string {
  const headers = 'name,email,company,jobTitle,linkedinProfileUrl';
  const rows = Array.from({ length: count }, (_, i) => {
    const timestamp = Date.now() + i;
    return [
      `Test Lead ${timestamp}`,
      `lead-${timestamp}@example.com`,
      'Test Company',
      'CEO',
      `https://linkedin.com/in/test-lead-${timestamp}`,
    ].join(',');
  });

  return [headers, ...rows].join('\n');
}

/**
 * Page setup utilities
 */

/**
 * Navigates to the dashboard page
 *
 * @param page - Playwright Page object
 */
export async function goToDashboard(page: Page) {
  await page.goto('/dashboard');
  await page.waitForURL('**/dashboard');
}

/**
 * Navigates to the leads page
 *
 * @param page - Playwright Page object
 */
export async function goToLeadsPage(page: Page) {
  await page.goto('/dashboard/leads');
  await page.waitForURL('**/dashboard/leads');
  // Wait for Kanban board to load
  await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });
}

/**
 * Navigates to the audiences page
 *
 * @param page - Playwright Page object
 */
export async function goToAudiencesPage(page: Page) {
  await page.goto('/dashboard/audiences');
  await page.waitForURL('**/dashboard/audiences');
  await page.waitForSelector('[data-testid="audiences-list"]', { timeout: 5000 });
}

/**
 * Navigates to the settings page
 *
 * @param page - Playwright Page object
 */
export async function goToSettings(page: Page) {
  await page.goto('/dashboard/settings');
  await page.waitForURL('**/dashboard/settings');
}

/**
 * UI interaction helpers
 */

/**
 * Fills out a form with provided data
 *
 * @param page - Playwright Page object
 * @param data - Object containing field names and values
 * @param options - Options for form filling
 */
export async function fillForm(
  page: Page,
  data: Record<string, string>,
  options?: {
    selectorPrefix?: string;
    submitButtonSelector?: string;
  }
) {
  const { selectorPrefix = '', submitButtonSelector } = options || {};

  for (const [fieldName, value] of Object.entries(data)) {
    const selector = selectorPrefix
      ? `${selectorPrefix} [name="${fieldName}"], ${selectorPrefix} [data-testid="${fieldName}"]`
      : `[name="${fieldName}"], [data-testid="${fieldName}"]`;

    const element = page.locator(selector).first();
    await element.fill(value);
  }

  if (submitButtonSelector) {
    await page.click(submitButtonSelector);
  }
}

/**
 * Waits for a modal to appear and returns it
 *
 * @param page - Playwright Page object
 * @param selector - Modal selector (defaults to common modal selectors)
 * @returns Modal locator
 */
export async function waitForModal(
  page: Page,
  selector: string = '[role="dialog"], [data-testid="modal"]'
): Promise<Locator> {
  await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
  return page.locator(selector).first();
}

/**
 * Closes the currently visible modal
 *
 * @param page - Playwright Page object
 */
export async function closeModal(page: Page) {
  const closeButton = page.locator('[role="dialog"] button[aria-label="Close"], [data-testid="modal"] button[aria-label="Close"]').first();
  await closeButton.click();
  await page.waitForSelector('[role="dialog"], [data-testid="modal"]', { state: 'hidden', timeout: 5000 });
}

/**
 * Clicks a button by text or data-testid
 *
 * @param page - Playwright Page object
 * @param identifier - Button text or data-testid value
 * @param options - Click options
 */
export async function clickButton(
  page: Page,
  identifier: string,
  options?: { exact?: boolean; timeout?: number }
) {
  const timeout = options?.timeout || 5000;

  // Try by data-testid first
  const buttonByTestId = page.locator(`[data-testid="${identifier}"]`).first();
  const isVisible = await buttonByTestId.isVisible().catch(() => false);

  if (isVisible) {
    await buttonByTestId.click({ timeout });
    return;
  }

  // Try by text
  const buttonText = page.locator(`button:has-text("${identifier}")`).first();
  await buttonText.click({ timeout });
}

/**
 * Waits for a toast/notification to appear
 *
 * @param page - Playwright Page object
 * @param text - Optional text to match in toast
 * @returns Toast locator
 */
export async function waitForToast(
  page: Page,
  text?: string
): Promise<Locator> {
  const selector = text
    ? `[role="alert"]:has-text("${text}")`
    : '[role="alert"]';

  await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
  return page.locator(selector).first();
}

/**
 * Gets the text content of an element
 *
 * @param locator - Playwright Locator
 * @returns Text content
 */
export async function getTextContent(locator: Locator): Promise<string> {
  return await locator.textContent({ timeout: 5000 }) || '';
}

/**
 * Checks if an element is visible
 *
 * @param locator - Playwright Locator
 * @returns True if visible, false otherwise
 */
export async function isVisible(locator: Locator): Promise<boolean> {
  return await locator.isVisible().catch(() => false);
}

/**
 * Drag and drop helper
 *
 * @param page - Playwright Page object
 * @param source - Source element selector
 * @param target - Target element selector
 */
export async function dragAndDrop(
  page: Page,
  source: string,
  target: string
) {
  await page.dragAndDrop(source, target);
}

/**
 * Takes a screenshot on failure
 *
 * @param page - Playwright Page object
 * @param testName - Test name for the screenshot file
 */
export async function takeScreenshotOnFailure(page: Page, testName: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `test-results/screenshots/failure-${testName}-${timestamp}.png`,
    fullPage: true,
  });
}

/**
 * Setup and teardown helpers
 */

/**
 * Clears localStorage and sessionStorage
 *
 * @param page - Playwright Page object
 */
export async function clearStorage(page: Page) {
  try {
    await page.evaluate(() => {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
    });
  } catch (error) {
    // localStorage might not be accessible on certain pages (about:blank, data URLs, etc.)
    // This is fine - context.clearCookies() will handle most cleanup
  }
}

/**
 * Sets auth tokens in localStorage
 *
 * @param page - Playwright Page object
 * @param accessToken - Access token
 * @param refreshToken - Refresh token
 */
export function setAuthTokens(
  page: Page,
  accessToken: string,
  refreshToken: string
) {
  return page.evaluate(
    ({ token, refresh }) => {
      localStorage.setItem('accessToken', token);
      localStorage.setItem('refreshToken', refresh);
    },
    { token: accessToken, refresh: refreshToken }
  );
}

/**
 * Gets auth tokens from localStorage
 *
 * @param page - Playwright Page object
 * @returns Object containing access and refresh tokens
 */
export async function getAuthTokens(page: Page) {
  return page.evaluate(() => ({
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
  }));
}

/**
 * Waits for API call to complete (by checking network idle)
 *
 * @param page - Playwright Page object
 * @param timeout - Timeout in milliseconds
 */
export async function waitForApiCall(page: Page, timeout: number = 5000) {
  await page.waitForLoadState('networkidle', { timeout });
}
