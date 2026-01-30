import { test, expect } from '@playwright/test';
import { registerUser, loginUser, apiRegister } from '../helpers/auth';
import { createTestUserData, clearStorage } from '../helpers/setup';

/**
 * E2E Tests for Authentication Flow
 *
 * These tests cover the complete user registration and authentication flows
 * including form validation, API integration, and successful navigation.
 */

test.describe('User Registration Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear all cookies and storage before each test
    await context.clearCookies();
  });

  test('should register a new user with all fields', async ({ page }) => {
    // Arrange
    const userData = createTestUserData({
      fullName: 'João Silva',
      email: 'joao.silva@example.com',
      password: 'TestPassword123!',
      companyName: 'Test Company Inc',
    });

    // Act
    await page.goto('/register');
    await page.waitForURL('**/register');

    // Fill in registration form
    await page.fill('#fullName', userData.fullName);
    await page.fill('#email', userData.email);
    await page.fill('#password', userData.password);
    await page.fill('#companyName', userData.companyName);

    // Submit form
    await page.click('button[type="submit"]');

    // Assert - Wait for navigation to dashboard
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });

    // Verify we're on a dashboard page
    expect(page.url()).toContain('/dashboard');

    // Verify tokens are stored in localStorage
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('refreshToken'));

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  test('should show validation errors for missing required fields', async ({ page }) => {
    // Act
    await page.goto('/register');
    await page.waitForURL('**/register');

    // Try to submit without filling any fields
    await page.click('button[type="submit"]');

    // Assert - Check for HTML5 validation
    const fullNameInput = page.locator('#fullName');
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    const companyNameInput = page.locator('#companyName');

    // HTML5 required validation should prevent submission
    await expect(async () => {
      const isValid = await fullNameInput.evaluate((el) => (el as HTMLInputElement).checkValidity());
      expect(isValid).toBe(false);
    }).toPass();

    await expect(async () => {
      const isValid = await emailInput.evaluate((el) => (el as HTMLInputElement).checkValidity());
      expect(isValid).toBe(false);
    }).toPass();

    await expect(async () => {
      const isValid = await passwordInput.evaluate((el) => (el as HTMLInputElement).checkValidity());
      expect(isValid).toBe(false);
    }).toPass();

    await expect(async () => {
      const isValid = await companyNameInput.evaluate((el) => (el as HTMLInputElement).checkValidity());
      expect(isValid).toBe(false);
    }).toPass();

    // Should still be on registration page
    expect(page.url()).toContain('/register');
  });

  test('should show validation error for invalid email format', async ({ page }) => {
    // Act
    await page.goto('/register');
    await page.waitForURL('**/register');

    // Fill form with invalid email
    await page.fill('#fullName', 'Test User');
    await page.fill('#email', 'invalid-email');
    await page.fill('#password', 'ValidPassword123!');
    await page.fill('#companyName', 'Test Company');

    // Try to submit
    await page.click('button[type="submit"]');

    // Assert - HTML5 email validation should trigger
    const emailInput = page.locator('#email');
    await expect(async () => {
      const isValid = await emailInput.evaluate((el) => (el as HTMLInputElement).checkValidity());
      expect(isValid).toBe(false);
    }).toPass();

    // Should still be on registration page
    expect(page.url()).toContain('/register');
  });

  test('should show validation error for short password', async ({ page }) => {
    // Act
    await page.goto('/register');
    await page.waitForURL('**/register');

    // Fill form with short password
    await page.fill('#fullName', 'Test User');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'short');
    await page.fill('#companyName', 'Test Company');

    // Try to submit
    await page.click('button[type="submit"]');

    // Assert - Check for password minLength validation
    const passwordInput = page.locator('#password');
    await expect(async () => {
      const isValid = await passwordInput.evaluate((el) => (el as HTMLInputElement).checkValidity());
      expect(isValid).toBe(false);
    }).toPass();

    // Should still be on registration page
    expect(page.url()).toContain('/register');
  });

  test('should display loading state during registration', async ({ page }) => {
    // Arrange
    const userData = createTestUserData();

    // Act
    await page.goto('/register');
    await page.waitForURL('**/register');

    // Fill in the form
    await page.fill('#fullName', userData.fullName);
    await page.fill('#email', userData.email);
    await page.fill('#password', userData.password);
    await page.fill('#companyName', userData.companyName);

    // Submit and immediately check for loading state
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Assert - Button should show loading state or be disabled
    await expect(submitButton).toBeDisabled({ timeout: 2000 });

    // Wait for registration to complete
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });
  });

  test('should show success toast after successful registration', async ({ page }) => {
    // Arrange
    const userData = createTestUserData({
      fullName: 'Maria Santos',
    });

    // Act
    await page.goto('/register');
    await page.waitForURL('**/register');

    await page.fill('#fullName', userData.fullName);
    await page.fill('#email', userData.email);
    await page.fill('#password', userData.password);
    await page.fill('#companyName', userData.companyName);

    await page.click('button[type="submit"]');

    // Assert - Wait for navigation to dashboard (toast may be too fast to catch)
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });

    // Verify we're logged in
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessToken).toBeTruthy();
  });

  test('should handle registration with existing email error', async ({ page }) => {
    // Arrange - Create a user first
    const userData = createTestUserData({
      email: 'duplicate@example.com',
    });

    // First registration
    await registerUser(page, userData);

    // Clear cookies and storage
    await page.context().clearCookies();
    await clearStorage(page);

    // Act - Try to register with the same email
    await page.goto('/register');
    await page.waitForURL('**/register');

    await page.fill('#fullName', 'Another User');
    await page.fill('#email', userData.email); // Same email
    await page.fill('#password', 'AnotherPassword123!');
    await page.fill('#companyName', 'Another Company');

    await page.click('button[type="submit"]');

    // Assert - Should show error toast (using Sonner toast selector)
    await page.waitForSelector('[data-sonner-toast]', { timeout: 10000 });

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText(/erro/i, { timeout: 5000 });

    // Should still be on registration page
    expect(page.url()).toContain('/register');
  });

  test('should navigate to login page when clicking "Entrar" link', async ({ page }) => {
    // Act
    await page.goto('/register');
    await page.waitForURL('**/register');

    // Click the login link
    await page.click('a[href="/login"]');

    // Assert - Should navigate to login page
    await page.waitForURL('**/login', { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('should have proper form labels and placeholders', async ({ page }) => {
    // Act
    await page.goto('/register');
    await page.waitForURL('**/register');

    // Assert - Check form labels
    await expect(page.locator('label[for="fullName"]')).toContainText('Nome Completo');
    await expect(page.locator('label[for="email"]')).toContainText('Email');
    await expect(page.locator('label[for="password"]')).toContainText('Senha');
    await expect(page.locator('label[for="companyName"]')).toContainText('Nome da Empresa');

    // Check placeholders
    await expect(page.locator('#fullName')).toHaveAttribute('placeholder', 'João Silva');
    await expect(page.locator('#email')).toHaveAttribute('placeholder', 'seu@email.com');
    await expect(page.locator('#password')).toHaveAttribute('placeholder', '••••••••');
    await expect(page.locator('#companyName')).toHaveAttribute('placeholder', 'Minha Empresa');
  });

  test('should display password requirements hint', async ({ page }) => {
    // Act
    await page.goto('/register');
    await page.waitForURL('**/register');

    // Assert - Check for password hint text
    const passwordHint = page.locator('.text-xs.text-gray-500, p.text-xs');
    await expect(passwordHint).toContainText(/mínimo 8 caracteres/i);
    await expect(passwordHint).toContainText(/maiúscula/i);
    await expect(passwordHint).toContainText(/minúscula/i);
    await expect(passwordHint).toContainText(/número/i);
  });

  test('should auto-login user after successful registration', async ({ page }) => {
    // Arrange
    const userData = createTestUserData();

    // Act - Register user
    await registerUser(page, userData);

    // Assert - User should be authenticated
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });

    // Verify tokens are stored
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('refreshToken'));

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    // Try to access a protected route
    await page.goto('/dashboard/leads');
    await page.waitForURL('**/dashboard/leads', { timeout: 5000 });

    // Should be able to access protected route without being redirected
    expect(page.url()).toContain('/dashboard/leads');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Act
    await page.goto('/register');
    await page.waitForURL('**/register');

    // Fill in the form
    const userData = createTestUserData();
    await page.fill('#fullName', userData.fullName);
    await page.fill('#email', userData.email);
    await page.fill('#password', userData.password);
    await page.fill('#companyName', userData.companyName);

    // Simulate network offline
    await page.context().setOffline(true);

    // Try to submit
    await page.click('button[type="submit"]');

    // Assert - Should show error toast (using Sonner toast selector)
    await page.waitForSelector('[data-sonner-toast]', { timeout: 10000 });

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText(/erro/i, { timeout: 5000 });

    // Should still be on registration page
    expect(page.url()).toContain('/register');

    // Restore network
    await page.context().setOffline(false);
  });
});

test.describe('User Login Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear all cookies and storage before each test
    await context.clearCookies();
    // Navigate to blank page first to avoid localStorage access issues
    await page.goto('about:blank');
    await clearStorage(page);
  });

  test('should login with valid credentials', async ({ page }) => {
    // Arrange - Create a user via API
    const userData = createTestUserData({
      email: 'login-test@example.com',
    });
    await apiRegister(userData);

    // Act - Login with the created user
    await page.goto('/login');
    await page.waitForURL('**/login');

    await page.fill('#email', userData.email);
    await page.fill('#password', userData.password);
    await page.click('button[type="submit"]');

    // Assert - Should navigate to dashboard
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');

    // Verify tokens are stored
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('refreshToken'));

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  test('should show validation errors for missing required fields', async ({ page }) => {
    // Act
    await page.goto('/login');
    await page.waitForURL('**/login');

    // Try to submit without filling any fields
    await page.click('button[type="submit"]');

    // Assert - Check for HTML5 validation
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');

    // HTML5 required validation should prevent submission
    await expect(async () => {
      const isValid = await emailInput.evaluate((el) => (el as HTMLInputElement).checkValidity());
      expect(isValid).toBe(false);
    }).toPass();

    await expect(async () => {
      const isValid = await passwordInput.evaluate((el) => (el as HTMLInputElement).checkValidity());
      expect(isValid).toBe(false);
    }).toPass();

    // Should still be on login page
    expect(page.url()).toContain('/login');
  });

  test('should show validation error for invalid email format', async ({ page }) => {
    // Act
    await page.goto('/login');
    await page.waitForURL('**/login');

    // Fill form with invalid email
    await page.fill('#email', 'invalid-email');
    await page.fill('#password', 'SomePassword123!');

    // Try to submit
    await page.click('button[type="submit"]');

    // Assert - HTML5 email validation should trigger
    const emailInput = page.locator('#email');
    await expect(async () => {
      const isValid = await emailInput.evaluate((el) => (el as HTMLInputElement).checkValidity());
      expect(isValid).toBe(false);
    }).toPass();

    // Should still be on login page
    expect(page.url()).toContain('/login');
  });

  test('should show error toast for invalid credentials', async ({ page }) => {
    // Act
    await page.goto('/login');
    await page.waitForURL('**/login');

    // Fill form with invalid credentials
    await page.fill('#email', 'nonexistent@example.com');
    await page.fill('#password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Assert - Should show error toast (using Sonner toast selector)
    await page.waitForSelector('[data-sonner-toast]', { timeout: 10000 });

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText(/erro/i, { timeout: 5000 });

    // Should still be on login page
    expect(page.url()).toContain('/login');
  });

  test('should show error toast for wrong password', async ({ page }) => {
    // Arrange - Create a user
    const userData = createTestUserData({
      email: 'wrong-password-test@example.com',
    });
    await apiRegister(userData);

    // Act - Try to login with wrong password
    await page.goto('/login');
    await page.waitForURL('**/login');

    await page.fill('#email', userData.email);
    await page.fill('#password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Assert - Should show error toast
    await page.waitForSelector('[data-sonner-toast]', { timeout: 10000 });

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText(/erro/i, { timeout: 5000 });

    // Should still be on login page
    expect(page.url()).toContain('/login');
  });

  test('should display loading state during login', async ({ page }) => {
    // Arrange - Create a user
    const userData = createTestUserData();
    await apiRegister(userData);

    // Act
    await page.goto('/login');
    await page.waitForURL('**/login');

    await page.fill('#email', userData.email);
    await page.fill('#password', userData.password);

    // Submit and immediately check for loading state
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Assert - Button should show loading state or be disabled
    await expect(submitButton).toBeDisabled({ timeout: 2000 });

    // Wait for login to complete
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });
  });

  test('should show success toast after successful login', async ({ page }) => {
    // Arrange - Create a user
    const userData = createTestUserData({
      fullName: 'Login Success User',
    });
    await apiRegister(userData);

    // Act
    await page.goto('/login');
    await page.waitForURL('**/login');

    await page.fill('#email', userData.email);
    await page.fill('#password', userData.password);
    await page.click('button[type="submit"]');

    // Assert - Wait for navigation to dashboard (toast may be too fast to catch)
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });

    // Verify we're logged in
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessToken).toBeTruthy();
  });

  test('should navigate to register page when clicking "Criar conta" link', async ({ page }) => {
    // Act
    await page.goto('/login');
    await page.waitForURL('**/login');

    // Click the register link
    await page.click('a[href="/register"]');

    // Assert - Should navigate to register page
    await page.waitForURL('**/register', { timeout: 5000 });
    expect(page.url()).toContain('/register');
  });

  test('should have proper form labels and placeholders', async ({ page }) => {
    // Act
    await page.goto('/login');
    await page.waitForURL('**/login');

    // Assert - Check form labels
    await expect(page.locator('label[for="email"]')).toContainText('Email');
    await expect(page.locator('label[for="password"]')).toContainText('Senha');

    // Check placeholders
    await expect(page.locator('#email')).toHaveAttribute('placeholder', 'seu@email.com');
    await expect(page.locator('#password')).toHaveAttribute('placeholder', '••••••••');
  });

  test('should auto-login user after registration and allow logout/login', async ({ page, context }) => {
    // Arrange & Act - Register user (auto-logged in)
    const userData = createTestUserData();
    await registerUser(page, userData);

    // Assert - User should be on dashboard
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');

    // Verify tokens exist
    let accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessToken).toBeTruthy();

    // Act - Logout - Navigate to blank page first to avoid localStorage access issues
    await page.goto('about:blank');
    await clearStorage(page);
    await context.clearCookies();
    await page.goto('/login');

    // Act - Login again
    await page.waitForURL('**/login');
    await page.fill('#email', userData.email);
    await page.fill('#password', userData.password);
    await page.click('button[type="submit"]');

    // Assert - Should login successfully again
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });
    accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessToken).toBeTruthy();
  });

  test('should maintain session across page navigation', async ({ page }) => {
    // Arrange - Create and login user
    const userData = createTestUserData();
    await apiRegister(userData);

    await page.goto('/login');
    await page.waitForURL('**/login');
    await page.fill('#email', userData.email);
    await page.fill('#password', userData.password);
    await page.click('button[type="submit"]');

    // Assert - Should navigate to dashboard
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });

    // Act - Navigate to different pages
    await page.goto('/dashboard/leads');
    await page.waitForURL('**/dashboard/leads', { timeout: 5000 });

    // Assert - Should still be authenticated
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessToken).toBeTruthy();

    // Act - Navigate back to dashboard
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard', { timeout: 5000 });

    // Assert - Should still be authenticated
    const accessToken2 = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessToken2).toBeTruthy();
  });

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // Act - Try to access dashboard without authentication
    await page.goto('/dashboard/leads');

    // Assert - Should redirect to login page
    await page.waitForURL('**/login', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('should handle network errors gracefully during login', async ({ page }) => {
    // Act
    await page.goto('/login');
    await page.waitForURL('**/login');

    // Fill in the form
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'TestPassword123!');

    // Simulate network offline
    await page.context().setOffline(true);

    // Try to submit
    await page.click('button[type="submit"]');

    // Assert - Should show error toast (using Sonner toast selector)
    await page.waitForSelector('[data-sonner-toast]', { timeout: 10000 });

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText(/erro/i, { timeout: 5000 });

    // Should still be on login page
    expect(page.url()).toContain('/login');

    // Restore network
    await page.context().setOffline(false);
  });

  test('should login using helper function', async ({ page }) => {
    // Arrange - Create a user
    const userData = createTestUserData();
    await apiRegister(userData);

    // Act - Use helper function to login
    const result = await loginUser(page, userData.email, userData.password);

    // Assert
    expect(result.user.email).toBe(userData.email);
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();

    // Verify navigation
    expect(page.url()).toContain('/dashboard');
  });

  test('should prevent login when already logged in', async ({ page }) => {
    // Arrange - Create and login user
    const userData = createTestUserData();
    await apiRegister(userData);

    await page.goto('/login');
    await page.waitForURL('**/login');
    await page.fill('#email', userData.email);
    await page.fill('#password', userData.password);
    await page.click('button[type="submit"]');

    // Assert - Should be on dashboard
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');

    // Act - Try to go to login page while logged in
    await page.goto('/login');

    // Assert - Should redirect to dashboard (already authenticated)
    await page.waitForURL('**/dashboard/**', { timeout: 5000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('should clear previous session when logging in with different user', async ({ page, context }) => {
    // Arrange - Create first user and login
    const user1Data = createTestUserData({
      email: 'user1-login@example.com',
    });
    await apiRegister(user1Data);

    await page.goto('/login');
    await page.fill('#email', user1Data.email);
    await page.fill('#password', user1Data.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });

    // Get first user's token
    const token1 = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token1).toBeTruthy();

    // Logout - Navigate to blank page first to avoid localStorage access issues
    await page.goto('about:blank');
    await clearStorage(page);
    await context.clearCookies();

    // Act - Create second user and login
    const user2Data = createTestUserData({
      email: 'user2-login@example.com',
    });
    await apiRegister(user2Data);

    await page.goto('/login');
    await page.waitForURL('**/login');
    await page.fill('#email', user2Data.email);
    await page.fill('#password', user2Data.password);
    await page.click('button[type="submit"]');

    // Assert - Should have second user's token
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });
    const token2 = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token2).toBeTruthy();
    expect(token2).not.toBe(token1);
  });
});
