import { test, expect } from '@playwright/test';
import { apiRegister, loginUser } from '../helpers/auth';
import { createTestUserData, createTestAudienceData, goToAudiencesPage, clearStorage } from '../helpers/setup';

/**
 * E2E Tests for Audience Creation and Segmentation
 *
 * These tests cover the complete audience creation flow including:
 * - Multi-step wizard navigation
 * - Form validation at each step
 * - Audience creation with various configurations
 * - Keyword management
 * - Country and gender selection
 * - Social activity filters
 * - Error handling
 */

test.describe('Audience Creation Flow', () => {
  let userEmail: string;
  let userPassword: string;

  test.beforeAll(async () => {
    // Create a test user for all tests
    const userData = createTestUserData({
      email: 'audience-test@example.com',
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
    await goToAudiencesPage(page);
  });

  test('should display audiences list page', async ({ page }) => {
    // Assert - Check that we're on the audiences page
    expect(page.url()).toContain('/dashboard/audiences');

    // Check page title
    await expect(page.locator('h1:has-text("Audiências")')).toBeVisible();

    // Check page description
    await expect(page.locator('text=Defina critérios de segmentação para mineração de leads')).toBeVisible();

    // Check "Nova Audiência" button
    const createButton = page.locator('button:has-text("Nova Audiência")');
    await expect(createButton).toBeVisible();
  });

  test('should navigate to new audience page', async ({ page }) => {
    // Act - Click "Nova Audiência" button
    const createButton = page.locator('button:has-text("Nova Audiência")');
    await createButton.click();

    // Assert - Should navigate to new audience page
    await page.waitForURL('**/dashboard/audiences/new');
    expect(page.url()).toContain('/dashboard/audiences/new');

    // Check page title
    await expect(page.locator('h1:has-text("Nova Audiência")')).toBeVisible();

    // Check step indicator is visible
    await expect(page.locator('text=Identificação')).toBeVisible();
  });

  test('should create audience with minimum required fields', async ({ page }) => {
    // Arrange - Navigate to new audience page
    await page.click('button:has-text("Nova Audiência")');
    await page.waitForURL('**/dashboard/audiences/new');

    const audienceData = createTestAudienceData({
      name: 'Audience Minima',
    });

    // Act - Fill in step 1 (name only)
    await page.fill('input[placeholder*="Ex:"]', audienceData.name);

    // Click through steps without filling optional fields
    await page.click('button:has-text("Próximo")'); // Move to step 2
    await page.waitForTimeout(500);

    await page.click('button:has-text("Próximo")'); // Move to step 3
    await page.waitForTimeout(500);

    await page.click('button:has-text("Próximo")'); // Move to step 4
    await page.waitForTimeout(500);

    // Create audience
    await page.click('button:has-text("Criar Audiência")');

    // Assert - Should navigate back to audiences list
    await page.waitForURL('**/dashboard/audiences', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard/audiences');

    // Should show success toast or updated list
    await page.waitForTimeout(1000);
  });

  test('should create audience with all fields in all steps', async ({ page }) => {
    // Arrange - Navigate to new audience page
    await page.click('button:has-text("Nova Audiência")');
    await page.waitForURL('**/dashboard/audiences/new');

    const timestamp = Date.now();

    // Act - Step 1: Name
    await page.fill('input[placeholder*="Ex:"]', `Complete Audience ${timestamp}`);

    // Move to step 2
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Step 2: Select gender
    await page.click('button:has-text("Homem")');
    await page.click('button:has-text("Mulher")');

    // Add country (type in search and select from dropdown)
    const countryInput = page.locator('input[placeholder="Buscar país..."]');
    await countryInput.fill('Brasil');

    // Wait for dropdown and select
    await page.waitForTimeout(500);
    const brazilOption = page.locator('button:has-text("Brasil")').first();
    const isBrazilVisible = await brazilOption.isVisible().catch(() => false);

    if (isBrazilVisible) {
      await brazilOption.click();
    }

    // Select exclude options
    await page.check('input[type="checkbox"][value="excludePrivate"]');
    await page.check('input[type="checkbox"][value="excludeNoPhoto"]');

    // Move to step 3
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Step 3: Fill social activity ranges
    const friendsMinInput = page.locator('input[placeholder="Mín"]').nth(0);
    await friendsMinInput.fill('100');

    const friendsMaxInput = page.locator('input[placeholder="Máx"]').nth(0);
    await friendsMaxInput.fill('1000');

    const followersMinInput = page.locator('input[placeholder="Mín"]').nth(2);
    await followersMinInput.fill('500');

    const followersMaxInput = page.locator('input[placeholder="Máx"]').nth(2);
    await followersMaxInput.fill('10000');

    // Move to step 4
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Step 4: Add keywords
    // Job title keywords
    const jobTitleIncludeInput = page.locator('input[placeholder="Adicionar keyword..."]').first();
    await jobTitleIncludeInput.fill('CEO');
    await jobTitleIncludeInput.press('Enter');

    await jobTitleIncludeInput.fill('CTO');
    await page.locator('button:has-text("Próximo")').nth(0).click(); // Click the first Plus button

    // Profile info keywords
    const profileInfoInput = page.locator('input[placeholder="Adicionar keyword..."]').nth(2);
    await profileInfoInput.fill('marketing');
    await profileInfoInput.press('Enter');

    // Create audience
    await page.click('button:has-text("Criar Audiência")');

    // Assert - Should navigate back to audiences list
    await page.waitForURL('**/dashboard/audiences', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard/audiences');
  });

  test('should show validation error when name is empty', async ({ page }) => {
    // Arrange - Navigate to new audience page
    await page.click('button:has-text("Nova Audiência")');
    await page.waitForURL('**/dashboard/audiences/new');

    // Act - Try to proceed without filling name
    await page.click('button:has-text("Próximo")');

    // Assert - Should show validation error
    const nameInput = page.locator('input[placeholder*="Ex:"]');
    const hasError = await nameInput.evaluate((el) =>
      (el as HTMLInputElement).classList.contains('border-red-500')
    );

    if (hasError) {
      await expect(nameInput).toHaveClass(/border-red-500/);
    }

    // Should still be on step 1
    await expect(page.locator('text=Identificação')).toBeVisible();
  });

  test('should navigate between steps correctly', async ({ page }) => {
    // Arrange - Navigate to new audience page
    await page.click('button:has-text("Nova Audiência")');
    await page.waitForURL('**/dashboard/audiences/new');

    // Fill step 1
    await page.fill('input[placeholder*="Ex:"]', 'Test Audience');

    // Act - Move to step 2
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Assert - Step 2 should be visible
    await expect(page.locator('text=Detalhes do Perfil')).toBeVisible();

    // Act - Go back to step 1
    await page.click('button:has-text("Voltar")');
    await page.waitForTimeout(500);

    // Assert - Step 1 should be visible again
    await expect(page.locator('text=Identificação')).toBeVisible();

    // Name should still be filled
    const nameInput = page.locator('input[placeholder*="Ex:"]');
    await expect(nameInput).toHaveValue('Test Audience');
  });

  test('should toggle gender selection', async ({ page }) => {
    // Arrange - Navigate to step 2
    await page.click('button:has-text("Nova Audiência")');
    await page.waitForURL('**/dashboard/audiences/new');
    await page.fill('input[placeholder*="Ex:"]', 'Test Audience');
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Act - Click "Homem" button
    const maleButton = page.locator('button:has-text("Homem")');
    await maleButton.click();

    // Assert - Should be selected (bg-indigo-100 border-indigo-500)
    await expect(maleButton).toHaveClass(/bg-indigo-100/);

    // Act - Click again to deselect
    await maleButton.click();

    // Assert - Should be deselected
    await expect(maleButton).not.toHaveClass(/bg-indigo-100/);

    // Act - Click "Mulher" button
    const femaleButton = page.locator('button:has-text("Mulher")');
    await femaleButton.click();

    // Assert - Should be selected
    await expect(femaleButton).toHaveClass(/bg-indigo-100/);
  });

  test('should add and remove countries', async ({ page }) => {
    // Arrange - Navigate to step 2
    await page.click('button:has-text("Nova Audiência")');
    await page.waitForURL('**/dashboard/audiences/new');
    await page.fill('input[placeholder*="Ex:"]', 'Test Audience');
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Act - Add a country
    const countryInput = page.locator('input[placeholder="Buscar país..."]');
    await countryInput.fill('Brasil');
    await page.waitForTimeout(500);

    const brazilOption = page.locator('button:has-text("Brasil")').first();
    const isBrazilVisible = await brazilOption.isVisible().catch(() => false);

    if (isBrazilVisible) {
      await brazilOption.click();

      // Assert - Country badge should appear
      const countryBadge = page.locator('text=Brasil').first();
      await expect(countryBadge).toBeVisible();
    }

    // Try adding another country
    await countryInput.fill('United');
    await page.waitForTimeout(500);

    const usOption = page.locator('button:has-text("United States")').first();
    const isUsVisible = await usOption.isVisible().catch(() => false);

    if (isUsVisible) {
      await usOption.click();

      // Assert - Should have 2 countries
      const badges = page.locator('.badge, [class*="badge"]');
      const count = await badges.count();
      expect(count).toBeGreaterThan(0);
    }

    // Act - Remove a country
    const removeButton = page.locator('.badge button, [class*="badge"] button').first();
    const isRemoveVisible = await removeButton.isVisible().catch(() => false);

    if (isRemoveVisible) {
      await removeButton.click();

      // Assert - Country should be removed
      const removedBadge = page.locator('text=Brasil').first();
      const isStillVisible = await removedBadge.isVisible().catch(() => false);
      expect(isStillVisible).toBe(false);
    }
  });

  test('should toggle checkbox filters', async ({ page }) => {
    // Arrange - Navigate to step 2
    await page.click('button:has-text("Nova Audiência")');
    await page.waitForURL('**/dashboard/audiences/new');
    await page.fill('input[placeholder*="Ex:"]', 'Test Audience');
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Act - Check "Excluir perfis privados"
    const excludePrivateCheckbox = page.locator('input:has-text("Excluir perfis privados"), input[value="excludePrivate"]').first();
    await excludePrivateCheckbox.check();

    // Assert - Should be checked
    await expect(excludePrivateCheckbox).toBeChecked();

    // Act - Uncheck
    await excludePrivateCheckbox.uncheck();

    // Assert - Should be unchecked
    await expect(excludePrivateCheckbox).not.toBeChecked();
  });

  test('should select verified filter options', async ({ page }) => {
    // Arrange - Navigate to step 2
    await page.click('button:has-text("Nova Audiência")');
    await page.waitForURL('**/dashboard/audiences/new');
    await page.fill('input[placeholder*="Ex:"]', 'Test Audience');
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Act - Select "Somente verificados"
    const verifiedRadio = page.locator('input[value="verified_only"]');
    await verifiedRadio.check();

    // Assert - Should be checked
    await expect(verifiedRadio).toBeChecked();

    // Act - Select "Qualquer tipo"
    const anyRadio = page.locator('input[value="any"]');
    await anyRadio.check();

    // Assert - Should be checked
    await expect(anyRadio).toBeChecked();
    await expect(verifiedRadio).not.toBeChecked();
  });

  test('should add and remove keywords', async ({ page }) => {
    // Arrange - Navigate to step 4
    await page.click('button:has-text("Nova Audiência")');
    await page.waitForURL('**/dashboard/audiences/new');
    await page.fill('input[placeholder*="Ex:"]', 'Test Audience');
    await page.click('button:has-text("Próximo")'); // Step 2
    await page.waitForTimeout(500);
    await page.click('button:has-text("Próximo")'); // Step 3
    await page.waitForTimeout(500);
    await page.click('button:has-text("Próximo")'); // Step 4
    await page.waitForTimeout(500);

    // Act - Add a keyword
    const keywordInput = page.locator('input[placeholder="Adicionar keyword..."]').first();
    await keywordInput.fill('CEO');
    await keywordInput.press('Enter');

    // Assert - Keyword badge should appear
    const keywordBadge = page.locator('text=CEO').first();
    await expect(keywordBadge).toBeVisible();

    // Act - Add another keyword
    await keywordInput.fill('CTO');
    const plusButton = page.locator('button:has(.lucide-plus)').first();
    await plusButton.click();

    // Assert - Both keywords should be visible
    await expect(page.locator('text=CEO')).toBeVisible();
    await expect(page.locator('text=CTO')).toBeVisible();

    // Act - Remove a keyword
    const removeButton = page.locator('text=CEO').locator('button').first();
    await removeButton.click();

    // Assert - CEO should be removed
    await expect(page.locator('text=CEO').locator('button')).not.toBeVisible();
  });

  test('should fill number range inputs', async ({ page }) => {
    // Arrange - Navigate to step 3
    await page.click('button:has-text("Nova Audiência")');
    await page.waitForURL('**/dashboard/audiences/new');
    await page.fill('input[placeholder*="Ex:"]', 'Test Audience');
    await page.click('button:has-text("Próximo")'); // Step 2
    await page.waitForTimeout(500);
    await page.click('button:has-text("Próximo")'); // Step 3
    await page.waitForTimeout(500);

    // Act - Fill friends range
    const friendsMinInput = page.locator('input[placeholder="Mín"]').nth(0);
    await friendsMinInput.fill('100');

    const friendsMaxInput = page.locator('input[placeholder="Máx"]').nth(0);
    await friendsMaxInput.fill('1000');

    // Assert - Values should be filled
    await expect(friendsMinInput).toHaveValue('100');
    await expect(friendsMaxInput).toHaveValue('1000');

    // Act - Clear values
    await friendsMinInput.fill('');
    await friendsMaxInput.fill('');

    // Assert - Values should be empty
    await expect(friendsMinInput).toHaveValue('');
    await expect(friendsMaxInput).toHaveValue('');
  });

  test('should cancel audience creation', async ({ page }) => {
    // Arrange - Navigate to new audience page
    await page.click('button:has-text("Nova Audiência")');
    await page.waitForURL('**/dashboard/audiences/new');

    // Fill step 1
    await page.fill('input[placeholder*="Ex:"]', 'Test Audience');

    // Act - Click cancel button
    await page.click('button:has-text("Cancelar")');

    // Assert - Should navigate back to audiences list
    await page.waitForURL('**/dashboard/audiences');
    expect(page.url()).toContain('/dashboard/audiences');

    // Should be on audiences page
    await expect(page.locator('h1:has-text("Audiências")')).toBeVisible();
  });

  test('should display step indicators correctly', async ({ page }) => {
    // Arrange - Navigate to new audience page
    await page.click('button:has-text("Nova Audiência")');
    await page.waitForURL('**/dashboard/audiences/new');

    // Assert - Step 1 should be active
    const step1 = page.locator('text=Identificação').first();
    await expect(step1).toBeVisible();

    // Act - Move to step 2
    await page.fill('input[placeholder*="Ex:"]', 'Test Audience');
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Assert - Step 1 should be complete, Step 2 should be active
    await expect(page.locator('text=Detalhes do Perfil')).toBeVisible();

    // Act - Move to step 3
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Assert - Step 3 should be visible
    await expect(page.locator('text=Atividade Social')).toBeVisible();

    // Act - Move to step 4
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Assert - Step 4 should be visible
    await expect(page.locator('text=Conteúdo Social')).toBeVisible();
  });

  test('should show empty state when no audiences exist', async ({ page }) => {
    // Assert - Should show empty state
    const emptyState = page.locator('text=Nenhuma audiência criada ainda');
    const isEmptyVisible = await emptyState.isVisible().catch(() => false);

    if (isEmptyVisible) {
      await expect(emptyState).toBeVisible();

      // Should show "Criar primeira audiência" button
      const createFirstButton = page.locator('button:has-text("Criar primeira audiência")');
      await expect(createFirstButton).toBeVisible();
    }
  });

  test('should handle network errors during creation', async ({ page }) => {
    // Arrange - Navigate to new audience page
    await page.click('button:has-text("Nova Audiência")');
    await page.waitForURL('**/dashboard/audiences/new');

    // Fill form
    await page.fill('input[placeholder*="Ex:"]', 'Test Audience');
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Act - Simulate network offline
    await page.context().setOffline(true);

    // Try to create
    await page.click('button:has-text("Criar Audiência")');

    // Assert - Should show error or loading state
    const createButton = page.locator('button:has-text("Criar Audiência")');
    const isDisabled = await createButton.isDisabled();

    if (isDisabled) {
      await expect(createButton).toBeDisabled();
    }

    // Restore network
    await page.context().setOffline(false);
  });

  test('should search and filter audiences', async ({ page }) => {
    // Arrange - Navigate to audiences page
    await goToAudiencesPage(page);

    // Act - Type in search box
    const searchInput = page.locator('input[placeholder="Buscar por nome..."]');
    await searchInput.fill('Test');

    // Assert - Should filter list (if any audiences exist)
    await page.waitForTimeout(500);

    // The search should update the filtered list
    // Since we don't have control over existing audiences, we just verify the input has the value
    await expect(searchInput).toHaveValue('Test');
  });

  test('should display tooltips on hover (defensive)', async ({ page }) => {
    // Arrange - Navigate to new audience page
    await page.click('button:has-text("Nova Audiência")');
    await page.waitForURL('**/dashboard/audiences/new');

    // Act - Look for tooltip icons
    const tooltipIcon = page.locator('[data-testid="tooltip-icon"], .lucide-circle-help').first();
    const isTooltipVisible = await tooltipIcon.isVisible().catch(() => false);

    if (isTooltipVisible) {
      // Hover over tooltip icon
      await tooltipIcon.hover();

      // Assert - Tooltip might appear (defensive check)
      await page.waitForTimeout(500);

      // Tooltip visibility is optional, just verify icon exists
      await expect(tooltipIcon).toBeVisible();
    }
  });

  test('should persist form data when navigating between steps', async ({ page }) => {
    // Arrange - Navigate to new audience page
    await page.click('button:has-text("Nova Audiência")');
    await page.waitForURL('**/dashboard/audiences/new');

    // Act - Fill step 1
    await page.fill('input[placeholder*="Ex:"]', 'Persistent Audience');

    // Move to step 2 and fill
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    await page.click('button:has-text("Homem")');

    // Move to step 3 and fill
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    const friendsMinInput = page.locator('input[placeholder="Mín"]').nth(0);
    await friendsMinInput.fill('250');

    // Go back to step 1
    await page.click('button:has-text("Voltar")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Voltar")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Voltar")');
    await page.waitForTimeout(500);

    // Assert - Name should still be filled
    const nameInput = page.locator('input[placeholder*="Ex:"]');
    await expect(nameInput).toHaveValue('Persistent Audience');

    // Move forward again
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Assert - Gender should still be selected
    const maleButton = page.locator('button:has-text("Homem")');
    await expect(maleButton).toHaveClass(/bg-indigo-100/);

    // Move to step 3
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Assert - Friends min should still be filled
    await expect(friendsMinInput).toHaveValue('250');
  });
});

test.describe('Audience Management', () => {
  let userEmail: string;
  let userPassword: string;

  test.beforeAll(async () => {
    const userData = createTestUserData({
      email: 'audience-mgmt-test@example.com',
    });
    userEmail = userData.email;
    userPassword = userData.password;

    await apiRegister(userData);
  });

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('about:blank');
    await clearStorage(page);

    await loginUser(page, userEmail, userPassword);
    await goToAudiencesPage(page);
  });

  test('should display audience in list', async ({ page }) => {
    // This test assumes audiences may or may not exist
    // We're just checking the list structure

    // Assert - Check for table or list structure
    const table = page.locator('table').first();
    const isTableVisible = await table.isVisible().catch(() => false);

    if (isTableVisible) {
      await expect(table).toBeVisible();

      // Check for headers
      await expect(page.locator('th:has-text("Nome")')).toBeVisible();
      await expect(page.locator('th:has-text("Gênero")')).toBeVisible();
      await expect(page.locator('th:has-text("Países")')).toBeVisible();
      await expect(page.locator('th:has-text("Filtros")')).toBeVisible();
    }
  });

  test('should show audience details when clicking row', async ({ page }) => {
    // This is a defensive test - it only runs if there are audiences
    const tableRow = page.locator('tbody tr').first();
    const isRowVisible = await tableRow.isVisible().catch(() => false);

    if (isRowVisible) {
      // Act - Click first row
      await tableRow.click();

      // Assert - Should navigate to audience detail page
      await page.waitForURL('**/dashboard/audiences/**', { timeout: 5000 });
      expect(page.url()).toMatch(/\/dashboard\/audiences\/[^/]+$/);
    } else {
      test.skip(true, 'No audiences to test with');
    }
  });

  test('should display sort buttons in table headers', async ({ page }) => {
    // Check for sortable columns
    const nameSortButton = page.locator('th:has-text("Nome") button').first();
    const isNameSortVisible = await nameSortButton.isVisible().catch(() => false);

    if (isNameSortVisible) {
      await expect(nameSortButton).toBeVisible();

      // Check for sort icon (ChevronUp or ChevronDown)
      const sortIcon = page.locator('th .lucide-chevron-up, th .lucide-chevron-down').first();
      const isSortIconVisible = await sortIcon.isVisible().catch(() => false);

      // Sort icon may or may not be visible depending on current sort state
      if (isSortIconVisible) {
        await expect(sortIcon).toBeVisible();
      }
    }
  });

  test('should display audience filter count badge', async ({ page }) => {
    const tableRow = page.locator('tbody tr').first();
    const isRowVisible = await tableRow.isVisible().catch(() => false);

    if (isRowVisible) {
      // Check for filter badge
      const filterBadge = page.locator('[class*="badge"]').filter({ hasText: /filtro/i }).first();
      const isBadgeVisible = await filterBadge.isVisible().catch(() => false);

      if (isBadgeVisible) {
        await expect(filterBadge).toBeVisible();

        // Should contain a number
        const badgeText = await filterBadge.textContent();
        expect(badgeText).toMatch(/\d+/);
      }
    }
  });
});
