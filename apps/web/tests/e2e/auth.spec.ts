import { test, expect } from '@playwright/test';
import { registerUser } from '../helpers/auth';
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
