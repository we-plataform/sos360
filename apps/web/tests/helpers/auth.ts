import { type Page, expect } from '@playwright/test';
import { createTestUserData, clearStorage, goToDashboard, setAuthTokens } from './setup';

/**
 * Authentication helpers for E2E tests
 */

/**
 * API base URL (from environment or default)
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Registers a new user via the registration form
 *
 * @param page - Playwright Page object
 * @param userData - Optional user data override
 * @returns Response data from registration API
 *
 * @example
 * ```ts
 * const { user, tokens } = await registerUser(page);
 * await registerUser(page, {
 *   email: 'custom@example.com',
 *   companyName: 'Custom Company',
 * });
 * ```
 */
export async function registerUser(
  page: Page,
  userData?: Partial<{
    email: string;
    password: string;
    fullName: string;
    companyName: string;
    workspaceName: string;
  }>
) {
  const testData = createTestUserData(userData);

  await page.goto('/register');
  await page.waitForURL('**/register');

  // Fill registration form
  await page.fill('#fullName', testData.fullName);
  await page.fill('#email', testData.email);
  await page.fill('#password', testData.password);
  await page.fill('#companyName', testData.companyName);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for navigation or context selection page
  await page.waitForURL('**/dashboard/**', { timeout: 10000 });

  // Get tokens from localStorage
  const tokens = await getAuthTokensFromPage(page);

  return {
    user: {
      id: expect.any(String),
      email: testData.email,
      fullName: testData.fullName,
    },
    tokens,
  };
}

/**
 * Logs in a user via the login form
 *
 * @param page - Playwright Page object
 * @param email - User email
 * @param password - User password
 * @returns Response data from login API
 *
 * @example
 * ```ts
 * await loginUser(page, 'test@example.com', 'password123');
 * // Or use predefined user
 * const userData = createTestUserData();
 * // First register the user...
 * // Then login
 * await loginUser(page, userData.email, userData.password);
 * ```
 */
export async function loginUser(
  page: Page,
  email: string,
  password: string
) {
  await page.goto('/login');
  await page.waitForURL('**/login');

  // Fill login form
  await page.fill('#email', email);
  await page.fill('#password', password);

  // Submit form
  await page.click('button[type="submit"], [data-testid="login-button"]');

  // Wait for navigation to dashboard
  await page.waitForURL('**/dashboard/**', { timeout: 10000 });

  // Get tokens from localStorage
  const tokens = await getAuthTokensFromPage(page);

  return {
    user: {
      email,
    },
    tokens,
  };
}

/**
 * Logs out the current user
 *
 * @param page - Playwright Page object
 */
export async function logoutUser(page: Page) {
  // Click logout button (assuming it exists in the UI)
  const logoutButton = page.locator('button:has-text("Logout"), [data-testid="logout-button"]').first();
  const isVisible = await logoutButton.isVisible().catch(() => false);

  if (isVisible) {
    await logoutButton.click();
  }

  // Alternatively, clear storage directly
  await clearStorage(page);

  // Wait for redirect to login page
  await page.waitForURL('**/login', { timeout: 5000 });
}

/**
 * Selects a company/workspace context after login
 *
 * @param page - Playwright Page object
 * @param companyId - Company ID
 * @param workspaceId - Workspace ID
 */
export async function selectContext(
  page: Page,
  companyId: string,
  workspaceId: string
) {
  // Get selection token from localStorage (set during registration/login)
  const selectionToken = await page.evaluate(() => localStorage.getItem('selectionToken'));

  if (!selectionToken) {
    throw new Error('No selection token found in localStorage');
  }

  // Make API call to select context
  await page.evaluate(
    async ({ apiUrl, token, companyId, workspaceId }) => {
      const response = await fetch(`${apiUrl}/api/v1/auth/select-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectionToken: token,
          companyId,
          workspaceId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to select context');
      }

      const data = await response.json();

      // Store new tokens
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
    },
    { apiUrl: API_URL, token: selectionToken, companyId, workspaceId }
  );

  // Reload page to apply context
  await page.reload();

  // Wait for dashboard to load
  await goToDashboard(page);
}

/**
 * Sets up an authenticated session for testing
 *
 * This helper bypasses the UI login flow and directly sets auth tokens,
 * useful for tests that start from an authenticated state.
 *
 * @param page - Playwright Page object
 * @param tokens - Auth tokens (access and refresh)
 *
 * @example
 * ```ts
 * await setupAuthenticatedSession(page, {
 *   accessToken: '...',
 *   refreshToken: '...',
 * });
 * await goToDashboard(page);
 * ```
 */
export async function setupAuthenticatedSession(
  page: Page,
  tokens: {
    accessToken: string;
    refreshToken: string;
  }
) {
  await setAuthTokens(page, tokens.accessToken, tokens.refreshToken);
  await page.goto('/dashboard');
}

/**
 * Performs direct API login and returns tokens
 *
 * This helper makes a direct API call to login and returns the tokens,
 * useful when you need to authenticate without going through the UI.
 *
 * @param email - User email
 * @param password - User password
 * @returns Auth tokens
 *
 * @example
 * ```ts
 * const tokens = await apiLogin('test@example.com', 'password123');
 * await setupAuthenticatedSession(page, tokens);
 * ```
 */
export async function apiLogin(email: string, password: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error('API login failed');
  }

  const data = await response.json();
  return {
    accessToken: data.data.accessToken,
    refreshToken: data.data.refreshToken,
  };
}

/**
 * Performs direct API registration and returns tokens
 *
 * @param userData - User registration data
 * @returns Auth tokens and user data
 */
export async function apiRegister(userData: {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  workspaceName?: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  user: any;
}> {
  const response = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.detail || 'API registration failed');
  }

  const data = await response.json();
  return {
    accessToken: data.data.accessToken,
    refreshToken: data.data.refreshToken,
    user: data.data.user,
  };
}

/**
 * Gets the current authenticated user from API
 *
 * @param page - Playwright Page object
 * @returns User data
 */
export async function getCurrentUser(page: Page) {
  return page.evaluate(async (apiUrl) => {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      throw new Error('No access token found');
    }

    const response = await fetch(`${apiUrl}/api/v1/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get current user');
    }

    const data = await response.json();
    return data.data;
  }, API_URL);
}

/**
 * Verifies that user is authenticated
 *
 * @param page - Playwright Page object
 * @returns True if authenticated, false otherwise
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const tokens = await getAuthTokensFromPage(page);
  return !!(tokens.accessToken && tokens.refreshToken);
}

/**
 * Gets auth tokens from page localStorage
 *
 * @param page - Playwright Page object
 * @returns Auth tokens
 */
export async function getAuthTokensFromPage(page: Page): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  return page.evaluate(() => ({
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
  }));
}

/**
 * Waits for authentication to complete
 *
 * @param page - Playwright Page object
 */
export async function waitForAuthentication(page: Page) {
  // Wait for either dashboard URL or login URL
  await page.waitForURL('**/dashboard/** | **/login', { timeout: 10000 });
}

/**
 * Creates a test user and authenticates them
 *
 * This is a convenience helper that combines user creation and authentication.
 *
 * @param page - Playwright Page object
 * @param userData - Optional user data override
 * @returns User data and tokens
 *
 * @example
 * ```ts
 * const { user, tokens } = await createAndAuthenticateUser(page);
 * // User is now registered and logged in
 * ```
 */
export async function createAndAuthenticateUser(
  page: Page,
  userData?: Partial<{
    email: string;
    password: string;
    fullName: string;
    companyName: string;
    workspaceName: string;
  }>
) {
  return registerUser(page, userData);
}

/**
 * Refreshes the access token using the refresh token
 *
 * @param page - Playwright Page object
 * @returns New access token
 */
export async function refreshAccessToken(page: Page): Promise<string> {
  return page.evaluate(async (apiUrl) => {
    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
      throw new Error('No refresh token found');
    }

    const response = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);

    return data.data.accessToken;
  }, API_URL);
}

/**
 * Expects the user to be redirected to the login page
 *
 * @param page - Playwright Page object
 */
export async function expectRedirectedToLogin(page: Page) {
  await page.waitForURL('**/login', { timeout: 5000 });
  expect(page.url()).toContain('/login');
}

/**
 * Expects the user to be on the dashboard
 *
 * @param page - Playwright Page object
 */
export async function expectOnDashboard(page: Page) {
  await page.waitForURL('**/dashboard/**', { timeout: 5000 });
  expect(page.url()).toContain('/dashboard');
}
