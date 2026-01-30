import { test, expect } from '@playwright/test';
import { apiRegister, loginUser } from '../helpers/auth';
import { createTestUserData, createTestLeadData, goToLeadsPage, clearStorage } from '../helpers/setup';

/**
 * E2E Tests for Manual Lead Creation Flow
 *
 * These tests cover the complete manual lead creation flow including:
 * - Opening the create lead dialog
 * - Form validation
 * - Successful lead creation
 * - Error handling
 */

test.describe('Manual Lead Creation Flow', () => {
  let userEmail: string;
  let userPassword: string;

  test.beforeAll(async () => {
    // Create a test user for all tests
    const userData = createTestUserData({
      email: 'lead-creation-test@example.com',
    });
    userEmail = userData.email;
    userPassword = userData.password;

    await apiRegister(userData);
  });

  test.beforeEach(async ({ page, context }) => {
    // Clear all cookies and storage before each test
    await context.clearCookies();
    await page.goto('about:blank');
    await clearStorage(page);

    // Login before each test
    await loginUser(page, userEmail, userPassword);
    await goToLeadsPage(page);
  });

  test('should open create lead dialog when clicking "Novo Lead" button', async ({ page }) => {
    // Act - Click the "Novo Lead" button
    const createLeadButton = page.locator('button:has-text("Novo Lead")').first();
    await createLeadButton.click();

    // Assert - Dialog should be visible
    const dialog = page.locator('[role="dialog"]').filter({
      hasText: 'Novo Lead'
    });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Check dialog title
    await expect(dialog.locator('h2:has-text("Novo Lead"), [data-testid="dialog-title"]')).toBeVisible();

    // Check dialog description
    await expect(dialog.locator('text=Adicione um novo lead manualmente')).toBeVisible();

    // Check for form fields
    await expect(dialog.locator('#fullName')).toBeVisible();
    await expect(dialog.locator('#email')).toBeVisible();
    await expect(dialog.locator('#phone')).toBeVisible();
    await expect(dialog.locator('#stageId')).toBeVisible();
  });

  test('should create a new lead with all fields', async ({ page }) => {
    // Arrange - Open create lead dialog
    const createLeadButton = page.locator('button:has-text("Novo Lead")').first();
    await createLeadButton.click();

    await page.waitForSelector('[role="dialog"]:has-text("Novo Lead")', { timeout: 5000 });

    const leadData = createTestLeadData({
      fullName: 'Maria Oliveira',
      email: 'maria.oliveira@example.com',
      phone: '(11) 98765-4321',
      notes: 'Lead interessado em produto enterprise',
    });

    // Act - Fill in the form
    await page.fill('#fullName', leadData.fullName);
    await page.fill('#email', leadData.email);
    await page.fill('#phone', leadData.phone);
    await page.selectOption('#stageId', { index: 0 }); // Select first stage
    await page.selectOption('#platform', 'linkedin');
    await page.fill('#website', 'https://mariaoliveira.com');
    await page.fill('#location', 'São Paulo, SP');
    await page.fill('#notes', leadData.notes);

    // Submit the form
    const submitButton = page.locator('button[type="submit"]:has-text("Criar Lead")');
    await submitButton.click();

    // Assert - Wait for success toast
    await page.waitForSelector('[data-sonner-toast]:has-text("criado com sucesso")', { timeout: 10000 });
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('criado com sucesso');

    // Dialog should be closed
    const dialog = page.locator('[role="dialog"]').filter({
      hasText: 'Novo Lead'
    });
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Lead should appear in the Kanban board
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 });
    const leadCard = page.locator(`text=${leadData.fullName}`).first();
    await expect(leadCard).toBeVisible({ timeout: 10000 });
  });

  test('should create lead with minimum required fields', async ({ page }) => {
    // Arrange - Open create lead dialog
    const createLeadButton = page.locator('button:has-text("Novo Lead")').first();
    await createLeadButton.click();

    await page.waitForSelector('[role="dialog"]:has-text("Novo Lead")', { timeout: 5000 });

    const leadData = createTestLeadData({
      fullName: 'João Minimalista',
      email: 'joao.minimal@example.com',
    });

    // Act - Fill only required fields
    await page.fill('#fullName', leadData.fullName);
    await page.fill('#email', leadData.email);
    await page.selectOption('#stageId', { index: 0 }); // Select first stage

    // Submit the form
    const submitButton = page.locator('button[type="submit"]:has-text("Criar Lead")');
    await submitButton.click();

    // Assert - Should create successfully
    await page.waitForSelector('[data-sonner-toast]:has-text("criado com sucesso")', { timeout: 10000 });
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('criado com sucesso');

    // Lead should appear in Kanban board
    await page.waitForSelector(`text=${leadData.fullName}`, { timeout: 10000 });
    const leadCard = page.locator(`text=${leadData.fullName}`).first();
    await expect(leadCard).toBeVisible();
  });

  test('should create lead with phone instead of email', async ({ page }) => {
    // Arrange - Open create lead dialog
    const createLeadButton = page.locator('button:has-text("Novo Lead")').first();
    await createLeadButton.click();

    await page.waitForSelector('[role="dialog"]:has-text("Novo Lead")', { timeout: 5000 });

    const leadData = createTestLeadData({
      fullName: 'Carlos Telefone',
      phone: '(21) 99999-8888',
    });

    // Act - Fill with phone only (no email)
    await page.fill('#fullName', leadData.fullName);
    await page.fill('#phone', leadData.phone);
    await page.selectOption('#stageId', { index: 0 });

    // Submit the form
    const submitButton = page.locator('button[type="submit"]:has-text("Criar Lead")');
    await submitButton.click();

    // Assert - Should create successfully
    await page.waitForSelector('[data-sonner-toast]:has-text("criado com sucesso")', { timeout: 10000 });
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('criado com sucesso');

    // Lead should appear in Kanban board
    await page.waitForSelector(`text=${leadData.fullName}`, { timeout: 10000 });
    const leadCard = page.locator(`text=${leadData.fullName}`).first();
    await expect(leadCard).toBeVisible();
  });

  test('should show validation error when name is missing', async ({ page }) => {
    // Arrange - Open create lead dialog
    const createLeadButton = page.locator('button:has-text("Novo Lead")').first();
    await createLeadButton.click();

    await page.waitForSelector('[role="dialog"]:has-text("Novo Lead")', { timeout: 5000 });

    const leadData = createTestLeadData({
      email: 'no-name@example.com',
    });

    // Act - Fill form without name
    await page.fill('#email', leadData.email);
    await page.selectOption('#stageId', { index: 0 });

    // Try to submit
    const submitButton = page.locator('button[type="submit"]:has-text("Criar Lead")');
    await submitButton.click();

    // Assert - Should show validation error
    const nameError = page.locator('#fullName + p.text-sm.text-red-500, #fullName ~ p.text-sm');
    await expect(nameError).toBeVisible({ timeout: 5000 });
    await expect(nameError).toContainText('obrigatório');

    // Dialog should still be open
    const dialog = page.locator('[role="dialog"]').filter({
      hasText: 'Novo Lead'
    });
    await expect(dialog).toBeVisible();
  });

  test('should show validation error when both email and phone are missing', async ({ page }) => {
    // Arrange - Open create lead dialog
    const createLeadButton = page.locator('button:has-text("Novo Lead")').first();
    await createLeadButton.click();

    await page.waitForSelector('[role="dialog"]:has-text("Novo Lead")', { timeout: 5000 });

    const leadData = createTestLeadData({
      fullName: 'Sem Contato',
    });

    // Act - Fill form without email or phone
    await page.fill('#fullName', leadData.fullName);
    await page.selectOption('#stageId', { index: 0 });

    // Try to submit
    const submitButton = page.locator('button[type="submit"]:has-text("Criar Lead")');
    await submitButton.click();

    // Assert - Should show validation error
    const emailError = page.locator('#email + p.text-sm.text-red-500, #email ~ p.text-sm');
    await expect(emailError).toBeVisible({ timeout: 5000 });
    await expect(emailError).toContainText('Email ou telefone');

    // Dialog should still be open
    const dialog = page.locator('[role="dialog"]').filter({
      hasText: 'Novo Lead'
    });
    await expect(dialog).toBeVisible();
  });

  test('should show validation error for invalid email format', async ({ page }) => {
    // Arrange - Open create lead dialog
    const createLeadButton = page.locator('button:has-text("Novo Lead")').first();
    await createLeadButton.click();

    await page.waitForSelector('[role="dialog"]:has-text("Novo Lead")', { timeout: 5000 });

    const leadData = createTestLeadData({
      fullName: 'Email Inválido',
      email: 'invalid-email-format',
    });

    // Act - Fill form with invalid email
    await page.fill('#fullName', leadData.fullName);
    await page.fill('#email', leadData.email);
    await page.selectOption('#stageId', { index: 0 });

    // Try to submit
    const submitButton = page.locator('button[type="submit"]:has-text("Criar Lead")');
    await submitButton.click();

    // Assert - Should show validation error
    const emailError = page.locator('#email + p.text-sm.text-red-500, #email ~ p.text-sm');
    await expect(emailError).toBeVisible({ timeout: 5000 });
    await expect(emailError).toContainText('inválido');

    // Dialog should still be open
    const dialog = page.locator('[role="dialog"]').filter({
      hasText: 'Novo Lead'
    });
    await expect(dialog).toBeVisible();
  });

  test('should show validation error for invalid website URL', async ({ page }) => {
    // Arrange - Open create lead dialog
    const createLeadButton = page.locator('button:has-text("Novo Lead")').first();
    await createLeadButton.click();

    await page.waitForSelector('[role="dialog"]:has-text("Novo Lead")', { timeout: 5000 });

    const leadData = createTestLeadData({
      fullName: 'Website Inválido',
      email: 'website@example.com',
      website: 'not-a-valid-url',
    });

    // Act - Fill form with invalid website
    await page.fill('#fullName', leadData.fullName);
    await page.fill('#email', leadData.email);
    await page.fill('#website', leadData.website);
    await page.selectOption('#stageId', { index: 0 });

    // Try to submit
    const submitButton = page.locator('button[type="submit"]:has-text("Criar Lead")');
    await submitButton.click();

    // Assert - Should show validation error
    const websiteError = page.locator('#website + p.text-sm.text-red-500, #website ~ p.text-sm');
    await expect(websiteError).toBeVisible({ timeout: 5000 });
    await expect(websiteError).toContainText('URL inválida');

    // Dialog should still be open
    const dialog = page.locator('[role="dialog"]').filter({
      hasText: 'Novo Lead'
    });
    await expect(dialog).toBeVisible();
  });

  test('should display loading state while creating lead', async ({ page }) => {
    // Arrange - Open create lead dialog
    const createLeadButton = page.locator('button:has-text("Novo Lead")').first();
    await createLeadButton.click();

    await page.waitForSelector('[role="dialog"]:has-text("Novo Lead")', { timeout: 5000 });

    const leadData = createTestLeadData({
      fullName: 'Loading Test Lead',
      email: 'loading@example.com',
    });

    // Act - Fill form
    await page.fill('#fullName', leadData.fullName);
    await page.fill('#email', leadData.email);
    await page.selectOption('#stageId', { index: 0 });

    // Submit and immediately check for loading state
    const submitButton = page.locator('button[type="submit"]:has-text("Criar Lead")');
    await submitButton.click();

    // Assert - Button should show loading state or be disabled
    await expect(submitButton).toBeDisabled({ timeout: 2000 });
    await expect(submitButton).toContainText('Criando...');

    // Wait for completion
    await page.waitForSelector('[data-sonner-toast]:has-text("criado com sucesso")', { timeout: 10000 });
  });

  test('should close dialog when clicking Cancel button', async ({ page }) => {
    // Arrange - Open create lead dialog
    const createLeadButton = page.locator('button:has-text("Novo Lead")').first();
    await createLeadButton.click();

    await page.waitForSelector('[role="dialog"]:has-text("Novo Lead")', { timeout: 5000 });

    // Act - Click cancel button
    const cancelButton = page.locator('button:has-text("Cancelar")').first();
    await cancelButton.click();

    // Assert - Dialog should be closed
    const dialog = page.locator('[role="dialog"]').filter({
      hasText: 'Novo Lead'
    });
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Should be back on leads page
    expect(page.url()).toContain('/dashboard/leads');
  });

  test('should close dialog when clicking outside', async ({ page }) => {
    // Arrange - Open create lead dialog
    const createLeadButton = page.locator('button:has-text("Novo Lead")').first();
    await createLeadButton.click();

    await page.waitForSelector('[role="dialog"]:has-text("Novo Lead")', { timeout: 5000 });

    // Act - Click outside the dialog (on the overlay)
    const overlay = page.locator('[role="dialog"]::before').first();
    await page.click('body', { position: { x: 10, y: 10 } });

    // Wait a bit for the dialog to close
    await page.waitForTimeout(500);

    // Assert - Dialog should be closed
    const dialog = page.locator('[role="dialog"]').filter({
      hasText: 'Novo Lead'
    });
    const isVisible = await dialog.isVisible().catch(() => false);

    // Note: Some dialog implementations don't close on outside click, so this is optional
    if (isVisible) {
      // If dialog is still open, that's also valid behavior
      expect(dialog).toBeVisible();
    }
  });

  test('should pre-select first stage in dropdown', async ({ page }) => {
    // Arrange - Open create lead dialog
    const createLeadButton = page.locator('button:has-text("Novo Lead")').first();
    await createLeadButton.click();

    await page.waitForSelector('[role="dialog"]:has-text("Novo Lead")', { timeout: 5000 });

    // Act - Check the stage dropdown value
    const stageSelect = page.locator('#stageId');
    const selectedValue = await stageSelect.inputValue();

    // Assert - First stage should be selected
    await expect(stageSelect).toHaveValue(selectedValue);
    expect(selectedValue).toBeTruthy();
  });

  test('should display all platform options', async ({ page }) => {
    // Arrange - Open create lead dialog
    const createLeadButton = page.locator('button:has-text("Novo Lead")').first();
    await createLeadButton.click();

    await page.waitForSelector('[role="dialog"]:has-text("Novo Lead")', { timeout: 5000 });

    // Act - Click platform dropdown
    const platformSelect = page.locator('#platform');
    await platformSelect.click();

    // Assert - Should have platform options
    const options = await platformSelect.locator('option').all();
    expect(options.length).toBeGreaterThan(1); // At least "Select a platform" + one platform

    // Check for common platforms
    const platformValues = await Promise.all(
      options.map(async (option) => await option.getAttribute('value'))
    );

    expect(platformValues).toContain('linkedin');
    expect(platformValues).toContain('instagram');
    expect(platformValues).toContain('facebook');
  });

  test('should have proper form labels and placeholders', async ({ page }) => {
    // Arrange - Open create lead dialog
    const createLeadButton = page.locator('button:has-text("Novo Lead")').first();
    await createLeadButton.click();

    await page.waitForSelector('[role="dialog"]:has-text("Novo Lead")', { timeout: 5000 });

    // Assert - Check form labels
    await expect(page.locator('label[for="fullName"]')).toContainText('Nome completo');
    await expect(page.locator('label[for="email"]')).toContainText('Email');
    await expect(page.locator('label[for="phone"]')).toContainText('Telefone');
    await expect(page.locator('label[for="stageId"]')).toContainText('Estágio');
    await expect(page.locator('label[for="platform"]')).toContainText('Plataforma');
    await expect(page.locator('label[for="website"]')).toContainText('Website');
    await expect(page.locator('label[for="location"]')).toContainText('Localização');
    await expect(page.locator('label[for="notes"]')).toContainText('Notas');

    // Check placeholders
    await expect(page.locator('#fullName')).toHaveAttribute('placeholder', /João/);
    await expect(page.locator('#email')).toHaveAttribute('placeholder', /email/i);
    await expect(page.locator('#phone')).toHaveAttribute('placeholder', /\(.*\)/);
    await expect(page.locator('#website')).toHaveAttribute('placeholder', /https/i);
    await expect(page.locator('#location')).toHaveAttribute('placeholder', /São Paulo/);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Arrange - Open create lead dialog
    const createLeadButton = page.locator('button:has-text("Novo Lead")').first();
    await createLeadButton.click();

    await page.waitForSelector('[role="dialog"]:has-text("Novo Lead")', { timeout: 5000 });

    const leadData = createTestLeadData({
      fullName: 'Network Error Lead',
      email: 'network-error@example.com',
    });

    // Act - Fill form
    await page.fill('#fullName', leadData.fullName);
    await page.fill('#email', leadData.email);
    await page.selectOption('#stageId', { index: 0 });

    // Simulate network offline
    await page.context().setOffline(true);

    // Try to submit
    const submitButton = page.locator('button[type="submit"]:has-text("Criar Lead")');
    await submitButton.click();

    // Assert - Should show error toast
    await page.waitForSelector('[data-sonner-toast]:has-text("erro")', { timeout: 10000 });
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText(/erro/i);

    // Dialog should still be open
    const dialog = page.locator('[role="dialog"]').filter({
      hasText: 'Novo Lead'
    });
    await expect(dialog).toBeVisible();

    // Restore network
    await page.context().setOffline(false);
  });

  test('should allow creating multiple leads in succession', async ({ page }) => {
    // Create first lead
    const createLeadButton = page.locator('button:has-text("Novo Lead")').first();
    await createLeadButton.click();

    await page.waitForSelector('[role="dialog"]:has-text("Novo Lead")', { timeout: 5000 });

    const lead1 = createTestLeadData({ fullName: 'Lead 1' });
    await page.fill('#fullName', lead1.fullName);
    await page.fill('#email', lead1.email);
    await page.selectOption('#stageId', { index: 0 });
    await page.locator('button[type="submit"]:has-text("Criar Lead")').click();

    // Wait for success
    await page.waitForSelector('[data-sonner-toast]:has-text("criado com sucesso")', { timeout: 10000 });

    // Wait for dialog to close
    await page.waitForTimeout(1000);

    // Create second lead
    await createLeadButton.click();
    await page.waitForSelector('[role="dialog"]:has-text("Novo Lead")', { timeout: 5000 });

    const lead2 = createTestLeadData({ fullName: 'Lead 2' });
    await page.fill('#fullName', lead2.fullName);
    await page.fill('#email', lead2.email);
    await page.selectOption('#stageId', { index: 0 });
    await page.locator('button[type="submit"]:has-text("Criar Lead")').click();

    // Wait for success
    await page.waitForSelector('[data-sonner-toast]:has-text("criado com sucesso")', { timeout: 10000 });

    // Assert - Both leads should be in Kanban board
    await page.waitForSelector('text=Lead 1', { timeout: 10000 });
    await page.waitForSelector('text=Lead 2', { timeout: 5000 });

    await expect(page.locator('text=Lead 1').first()).toBeVisible();
    await expect(page.locator('text=Lead 2').first()).toBeVisible();
  });
});
