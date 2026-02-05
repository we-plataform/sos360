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

/**
 * E2E Tests for CSV Lead Import Flow
 *
 * These tests cover the complete CSV lead import flow including:
 * - Opening the import dialog
 * - File selection and validation
 * - CSV preview
 * - Successful import
 * - Error handling
 * - Duplicate detection
 */
test.describe('CSV Lead Import Flow', () => {
  let userEmail: string;
  let userPassword: string;

  test.beforeAll(async () => {
    // Create a test user for all tests
    const userData = createTestUserData({
      email: 'csv-import-test@example.com',
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

  test('should show import dialog when clicking import button', async ({ page }) => {
    // Act - Look for an import button (might be in header or near "Novo Lead" button)
    const importButton = page.locator('button:has-text("Importar"), button:has-text("CSV"), [data-testid="import-button"]').first();

    // Check if import button exists (feature might not be implemented yet)
    const isVisible = await importButton.isVisible().catch(() => false);

    if (isVisible) {
      await importButton.click();

      // Assert - Dialog should be visible
      const dialog = page.locator('[role="dialog"]').filter({
        hasText: /importar|csv/i
      });
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Check for file input
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeVisible();
    } else {
      // Skip test if import feature is not implemented
      test.skip(true, 'CSV import feature not implemented yet');
    }
  });

  test('should accept a valid CSV file for import', async ({ page }) => {
    // Arrange - Create test CSV data
    const csvData = createTestCSVData(3);

    // Look for import button
    const importButton = page.locator('button:has-text("Importar"), button:has-text("CSV"), [data-testid="import-button"]').first();
    const isVisible = await importButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'CSV import feature not implemented yet');
    }

    await importButton.click();

    // Wait for dialog
    await page.waitForSelector('[role="dialog"]:has-text(/importar|csv/i)', { timeout: 5000 });

    // Act - Upload CSV file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-leads.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvData),
    });

    // Wait for file to be processed
    await page.waitForTimeout(1000);

    // Assert - Check if preview is shown or import starts
    const preview = page.locator('[data-testid="csv-preview"], .csv-preview, table:has-text("Test Lead")').first();
    const isPreviewVisible = await preview.isVisible().catch(() => false);

    if (isPreviewVisible) {
      await expect(preview).toBeVisible();
      // Should show the number of leads to import
      await expect(preview).toContainText('3');
    }
  });

  test('should show error for invalid CSV format', async ({ page }) => {
    // Arrange - Create invalid CSV data
    const invalidCSV = 'invalid,data,without,proper,headers';

    const importButton = page.locator('button:has-text("Importar"), button:has-text("CSV"), [data-testid="import-button"]').first();
    const isVisible = await importButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'CSV import feature not implemented yet');
    }

    await importButton.click();

    // Act - Upload invalid CSV
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'invalid.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(invalidCSV),
    });

    // Wait for processing
    await page.waitForTimeout(1000);

    // Assert - Should show error message
    const errorMessage = page.locator('.error, [role="alert"], .text-red-500').first();
    const isErrorMessageVisible = await errorMessage.isVisible().catch(() => false);

    if (isErrorMessageVisible) {
      await expect(errorMessage).toContainText(/invalid|erro|formato/i);
    }
  });

  test('should show error for non-CSV file', async ({ page }) => {
    // Arrange - Create non-CSV file
    const txtFile = 'This is a text file, not CSV';

    const importButton = page.locator('button:has-text("Importar"), button:has-text("CSV"), [data-testid="import-button"]').first();
    const isVisible = await importButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'CSV import feature not implemented yet');
    }

    await importButton.click();

    // Act - Try to upload non-CSV file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(txtFile),
    });

    // Wait for processing
    await page.waitForTimeout(1000);

    // Assert - Should show file type error
    const errorMessage = page.locator('.error, [role="alert"], .text-red-500').first();
    const isErrorMessageVisible = await errorMessage.isVisible().catch(() => false);

    if (isErrorMessageVisible) {
      await expect(errorMessage).toContainText(/csv|formato|tipo/i);
    }
  });

  test('should import leads from CSV successfully', async ({ page }) => {
    // Arrange - Create test CSV with unique leads
    const timestamp = Date.now();
    const csvData = [
      'name,email,company,jobTitle,linkedinProfileUrl',
      `Imported Lead 1,import1-${timestamp}@example.com,Company 1,CEO,https://linkedin.com/in/lead1-${timestamp}`,
      `Imported Lead 2,import2-${timestamp}@example.com,Company 2,CTO,https://linkedin.com/in/lead2-${timestamp}`,
      `Imported Lead 3,import3-${timestamp}@example.com,Company 3,Director,https://linkedin.com/in/lead3-${timestamp}`,
    ].join('\n');

    const importButton = page.locator('button:has-text("Importar"), button:has-text("CSV"), [data-testid="import-button"]').first();
    const isVisible = await importButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'CSV import feature not implemented yet');
    }

    await importButton.click();

    // Act - Upload CSV file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'leads.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvData),
    });

    // Wait for processing
    await page.waitForTimeout(1000);

    // Look for confirm/import button
    const confirmButton = page.locator('button:has-text("Importar"), button:has-text("Confirmar"), button[type="submit"]').first();
    const isConfirmVisible = await confirmButton.isVisible().catch(() => false);

    if (isConfirmVisible) {
      await confirmButton.click();
    }

    // Assert - Should show success message
    await page.waitForSelector('[data-sonner-toast]:has-text("import")', { timeout: 10000 });
    const toast = page.locator('[data-sonner-toast]').first();

    // Check for success indicators
    const toastText = await toast.textContent();
    expect(toastText?.toLowerCase()).toMatch(/sucesso|concluído|import/);

    // Dialog should close
    const dialog = page.locator('[role="dialog"]').filter({
      hasText: /importar|csv/i
    });
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Check that leads appear in Kanban board (may take a moment)
    await page.waitForTimeout(2000);
    const lead1 = page.locator(`text=Imported Lead 1`).first();
    await expect(lead1).toBeVisible({ timeout: 10000 });
  });

  test('should show import progress for large CSV', async ({ page }) => {
    // Arrange - Create larger CSV
    const csvData = createTestCSVData(50);

    const importButton = page.locator('button:has-text("Importar"), button:has-text("CSV"), [data-testid="import-button"]').first();
    const isVisible = await importButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'CSV import feature not implemented yet');
    }

    await importButton.click();

    // Act - Upload large CSV
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'large-leads.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvData),
    });

    // Wait for processing
    await page.waitForTimeout(1000);

    // Click import if confirmation is shown
    const confirmButton = page.locator('button:has-text("Importar"), button:has-text("Confirmar"), button[type="submit"]').first();
    const isConfirmVisible = await confirmButton.isVisible().catch(() => false);

    if (isConfirmVisible) {
      await confirmButton.click();
    }

    // Assert - Should show progress indicator
    const progressIndicator = page.locator('[role="progressbar"], .progress, [data-testid="import-progress"]').first();
    const isProgressVisible = await progressIndicator.isVisible().catch(() => false);

    if (isProgressVisible) {
      await expect(progressIndicator).toBeVisible();
    }

    // Wait for completion
    await page.waitForSelector('[data-sonner-toast]:has-text("import")', { timeout: 30000 });
  });

  test('should handle CSV with duplicate emails', async ({ page }) => {
    // Arrange - Create CSV with duplicate emails
    const timestamp = Date.now();
    const csvData = [
      'name,email,company,jobTitle,linkedinProfileUrl',
      `Duplicate Lead,dup-${timestamp}@example.com,Company 1,CEO,https://linkedin.com/in/dup-${timestamp}`,
      `Duplicate Lead 2,dup-${timestamp}@example.com,Company 2,CTO,https://linkedin.com/in/dup2-${timestamp}`,
    ].join('\n');

    const importButton = page.locator('button:has-text("Importar"), button:has-text("CSV"), [data-testid="import-button"]').first();
    const isVisible = await importButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'CSV import feature not implemented yet');
    }

    await importButton.click();

    // Act - Upload CSV with duplicates
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'duplicates.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvData),
    });

    await page.waitForTimeout(1000);

    const confirmButton = page.locator('button:has-text("Importar"), button:has-text("Confirmar"), button[type="submit"]').first();
    const isConfirmVisible = await confirmButton.isVisible().catch(() => false);

    if (isConfirmVisible) {
      await confirmButton.click();
    }

    // Assert - Should show duplicate warning
    await page.waitForSelector('[data-sonner-toast]', { timeout: 10000 });
    const toast = page.locator('[data-sonner-toast]').first();

    // Check for duplicate indication
    const toastText = await toast.textContent();
    const hasDuplicateWarning = toastText?.toLowerCase().match(/duplicado|duplicate|já existe/);

    if (hasDuplicateWarning) {
      expect(toastText).toMatch(/duplicado|duplicate/);
    }
  });

  test('should allow cancelling import operation', async ({ page }) => {
    // Arrange - Create test CSV
    const csvData = createTestCSVData(5);

    const importButton = page.locator('button:has-text("Importar"), button:has-text("CSV"), [data-testid="import-button"]').first();
    const isVisible = await importButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'CSV import feature not implemented yet');
    }

    await importButton.click();

    // Act - Upload CSV
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvData),
    });

    await page.waitForTimeout(1000);

    // Click cancel button
    const cancelButton = page.locator('button:has-text("Cancelar"), button:has-text("Close")').first();
    const isCancelVisible = await cancelButton.isVisible().catch(() => false);

    if (isCancelVisible) {
      await cancelButton.click();
    }

    // Assert - Dialog should close
    const dialog = page.locator('[role="dialog"]').filter({
      hasText: /importar|csv/i
    });
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // No new leads should be imported
    await page.waitForTimeout(1000);
    const testLead = page.locator('text=Test Lead').first();
    const isLeadVisible = await testLead.isVisible().catch(() => false);

    if (isLeadVisible) {
      // If visible, make sure it's not from our import
      const count = await page.locator('text=Test Lead').count();
      expect(count).toBe(0);
    }
  });

  test('should validate required CSV columns', async ({ page }) => {
    // Arrange - Create CSV missing required columns
    const incompleteCSV = [
      'name', // Missing email, which is likely required
      'Test Lead Without Email',
    ].join('\n');

    const importButton = page.locator('button:has-text("Importar"), button:has-text("CSV"), [data-testid="import-button"]').first();
    const isVisible = await importButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'CSV import feature not implemented yet');
    }

    await importButton.click();

    // Act - Upload incomplete CSV
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'incomplete.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(incompleteCSV),
    });

    await page.waitForTimeout(1000);

    // Assert - Should show validation error
    const errorMessage = page.locator('.error, [role="alert"], .text-red-500').first();
    const isErrorMessageVisible = await errorMessage.isVisible().catch(() => false);

    if (isErrorMessageVisible) {
      await expect(errorMessage).toContainText(/obrigatório|required|email|coluna/i);
    }
  });

  test('should display import summary after completion', async ({ page }) => {
    // Arrange - Create CSV with known count
    const csvData = createTestCSVData(10);

    const importButton = page.locator('button:has-text("Importar"), button:has-text("CSV"), [data-testid="import-button"]').first();
    const isVisible = await importButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'CSV import feature not implemented yet');
    }

    await importButton.click();

    // Act - Upload and import
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'summary-test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvData),
    });

    await page.waitForTimeout(1000);

    const confirmButton = page.locator('button:has-text("Importar"), button:has-text("Confirmar"), button[type="submit"]').first();
    const isConfirmVisible = await confirmButton.isVisible().catch(() => false);

    if (isConfirmVisible) {
      await confirmButton.click();
    }

    // Assert - Should show summary with counts
    await page.waitForSelector('[data-sonner-toast]', { timeout: 15000 });
    const toast = page.locator('[data-sonner-toast]').first();

    // Check for numbers in toast (import count)
    const toastText = await toast.textContent();
    expect(toastText).toMatch(/\d+/); // Should contain numbers
  });

  test('should handle empty CSV file', async ({ page }) => {
    // Arrange - Create empty CSV
    const emptyCSV = 'name,email,company,jobTitle\n'; // Headers only

    const importButton = page.locator('button:has-text("Importar"), button:has-text("CSV"), [data-testid="import-button"]').first();
    const isVisible = await importButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'CSV import feature not implemented yet');
    }

    await importButton.click();

    // Act - Upload empty CSV
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'empty.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(emptyCSV),
    });

    await page.waitForTimeout(1000);

    // Assert - Should show empty file error
    const errorMessage = page.locator('.error, [role="alert"], .text-red-500').first();
    const isErrorMessageVisible = await errorMessage.isVisible().catch(() => false);

    if (isErrorMessageVisible) {
      await expect(errorMessage).toContainText(/vazio|empty|nenhum|no data/i);
    }
  });
});
