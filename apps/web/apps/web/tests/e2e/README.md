# E2E Tests

End-to-end tests for the Lia360 web application using Playwright.

## Prerequisites

Before running E2E tests, make sure you have:

1. Installed dependencies: `npm install`
2. Installed Playwright browsers: `npx playwright install`
3. Database running (if testing API-dependent features)

## Running Tests

### Start Servers

E2E tests require both API and web servers to be running:

```bash
# Terminal 1 - Start API server
cd apps/api
npm run dev

# Terminal 2 - Start web server
cd apps/web
npm run dev

# Terminal 3 - Run tests
cd apps/web
npx playwright test
```

### Run All Tests

```bash
npx playwright test
```

### Run Specific Test File

```bash
npx playwright test tests/e2e/auth.spec.ts
npx playwright test tests/e2e/lead-capture.spec.ts
```

### Run Tests Matching a Pattern

```bash
# Run tests with "create" in the name
npx playwright test -g "create"

# Run tests with "login" in the name
npx playwright test -g "login"
```

### Run in Specific Browser

```bash
# Chromium (default)
npx playwright test --project=chromium

# Firefox
npx playwright test --project=firefox

# WebKit
npx playwright test --project=webkit
```

### Run Tests with UI

```bash
npx playwright test --ui
```

### Run Tests in Debug Mode

```bash
npx playwright test --debug
```

### Run Tests Headed (show browser window)

```bash
npx playwright test --headed
```

## Test Structure

```
tests/
├── e2e/
│   ├── auth.spec.ts           # Authentication flow tests
│   ├── lead-capture.spec.ts   # Manual lead creation tests
│   ├── kanban.spec.ts         # Kanban board tests (to be implemented)
│   ├── leads.spec.ts          # Lead detail and management tests (to be implemented)
│   └── audiences.spec.ts      # Audience segmentation tests (to be implemented)
└── helpers/
    ├── auth.ts                # Authentication helper functions
    └── setup.ts               # Test data factories and utilities
```

## Writing Tests

### Test Structure

Follow this pattern for new tests:

```typescript
import { test, expect } from '@playwright/test';
import { apiRegister, loginUser } from '../helpers/auth';
import { createTestUserData, goToLeadsPage, clearStorage } from '../helpers/setup';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear cookies and storage
    await context.clearCookies();
    await page.goto('about:blank');
    await clearStorage(page);

    // Login or perform setup
    await loginUser(page, 'email@example.com', 'password');
  });

  test('should do something', async ({ page }) => {
    // Arrange - Set up test data
    const testData = createTestUserData();

    // Act - Perform action
    await page.goto('/some-page');
    await page.click('#some-button');

    // Assert - Verify result
    await expect(page.locator('#result')).toBeVisible();
  });
});
```

### Best Practices

1. **Use helper functions** from `helpers/auth.ts` and `helpers/setup.ts`
2. **Follow Arrange-Act-Assert** pattern for clarity
3. **Use descriptive test names** that explain what is being tested
4. **Clean up in beforeEach** to ensure test isolation
5. **Wait for elements** using `waitForSelector` or `waitForTimeout` when needed
6. **Use data-testid attributes** for more stable selectors
7. **Test realistic user flows**, not implementation details
8. **Handle loading states** and network delays appropriately
9. **Use realistic test data** with timestamps to avoid conflicts
10. **Test error cases** as well as success cases

### Selectors

Prefer these selectors in order of stability:

1. `data-testid` attributes: `page.locator('[data-testid="submit-button"]')`
2. IDs: `page.locator('#email')`
3. Labels: `page.locator('label[for="email"]')`
6. Text content: `page.locator('button:has-text("Submit")')`

Avoid:
- CSS classes (can change)
- Complex selectors (brittle)
- XPath (hard to read)

## Test Data

Use the helper functions to generate test data:

```typescript
import { createTestUserData, createTestLeadData } from '../helpers/setup';

const user = createTestUserData({ email: 'custom@example.com' });
const lead = createTestLeadData({ name: 'Custom Lead' });
```

All data factories automatically include timestamps to avoid conflicts.

## Troubleshooting

### Tests Fail with "fetch failed"

Make sure the API server is running on port 3001:
```bash
cd apps/api && npm run dev
```

### Tests Fail with "Navigation Timeout"

Increase timeout in `playwright.config.ts` or use:
```typescript
await page.waitForURL('**/dashboard', { timeout: 30000 });
```

### Tests Are Flaky

- Add explicit waits for dynamic content
- Use `waitForSelector` instead of `waitForTimeout`
- Check for race conditions in your test logic
- Ensure proper cleanup in `beforeEach`

### Can't Find Elements

- Use Playwright's codegen: `npx playwright codegen`
- Check if elements are inside iframes
- Verify elements are not hidden by CSS
- Wait for animations to complete

## CI/CD Integration

These tests are configured to run in CI/CD:

- Runs on Chromium, Firefox, and WebKit
- Retry failed tests up to 2 times
- Parallel execution for faster results
- Generates HTML and JUnit reports
- Takes screenshots on failure

## Coverage

E2E tests currently cover:

- ✅ User registration flow
- ✅ User login flow
- ✅ Context selection flow
- ✅ Manual lead creation flow
- 🚧 CSV lead import (coming soon)
- 🚧 Kanban board view (coming soon)
- 🚧 Drag-and-drop operations (coming soon)
- 🚧 Lead filtering and search (coming soon)
- 🚧 Audience creation (coming soon)

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
