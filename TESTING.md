# TESTING.md

This file provides comprehensive testing guidelines for the Lia360 project.

## Testing Overview

Lia360 uses a multi-layered testing approach with different frameworks for each layer:

- **Unit & Integration Tests**: Vitest for API and shared packages
- **E2E Tests**: Playwright for frontend user flows
- **Coverage**: v8 provider with HTML, JSON, and text reports

## Running Tests

### Run All Tests

```bash
# Run all tests across the monorepo
npm run test

# Run all tests with coverage
npm run test:coverage
```

### API Tests (Vitest)

```bash
# Run API tests in watch mode
npm run test:api

# Run API tests once
npm run test --workspace=@lia360/api test:run

# Run API tests with UI
npm run test --workspace=@lia360/api test:ui

# Run API tests with coverage
npm run test --workspace=@lia360/api test:coverage

# Run specific test file
npm run test --workspace=@lia360/api -- src/routes/scoring.test.ts
```

### Web/E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:web

# Run E2E tests in headless mode
npm run test --workspace=@lia360/web test:headless

# Run E2E tests with UI
npm run test --workspace=@lia360/web test:ui

# Run E2E tests in debug mode
npm run test --workspace=@lia360/web test:debug

# Install Playwright browsers
npm run test --workspace=@lia360/web test:install
```

### Shared Package Tests

```bash
# Run shared package tests
npm run test --workspace=@lia360/shared

# Run with coverage
npm run test --workspace=@lia360/shared -- --coverage
```

## Coverage Guidelines

### Coverage Goals

- **Statement Coverage**: ≥ 80%
- **Branch Coverage**: ≥ 75%
- **Function Coverage**: ≥ 80%
- **Line Coverage**: ≥ 80%

### Viewing Coverage Reports

```bash
# Generate coverage for all packages
npm run test:coverage

# View API coverage report
open apps/api/coverage/index.html

# View shared package coverage
open packages/shared/coverage/index.html
```

### Coverage Configuration

Coverage is configured in `vitest.config.ts` for each package:

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  exclude: [
    'node_modules/',
    'dist/',
    'build/',
    '*.config.ts',
    '**/*.d.ts',
    '**/*.test.ts',
    '**/*.spec.ts',
  ],
}
```

## Testing Guidelines

### General Principles

1. **Arrange-Act-Assert Pattern**: Structure tests clearly with setup, execution, and verification
2. **Test Isolation**: Each test should be independent and not rely on other tests
3. **Descriptive Names**: Use clear, descriptive test names that explain what is being tested
4. **Mock External Dependencies**: Use mocks for external services (APIs, databases, etc.)
5. **Test Edge Cases**: Don't just test the happy path - test error cases and boundaries

### API Testing Guidelines (Vitest)

**File Structure**:
- Place tests alongside source files: `src/routes/scoring.test.ts`
- Or in dedicated test directories: `src/test/routes/scoring.test.ts`

**Test Structure**:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Feature Name', () => {
  beforeEach(async () => {
    // Setup before each test
    // Clean database, reset mocks, etc.
  });

  afterEach(async () => {
    // Cleanup after each test
  });

  it('should do something specific', async () => {
    // Arrange
    const input = { /* test data */ };

    // Act
    const result = await functionUnderTest(input);

    // Assert
    expect(result).toEqual({ /* expected output */ });
  });
});
```

**Best Practices**:

- Use `supertest` for HTTP endpoint testing
- Mock database calls with test fixtures
- Test authentication/authorization separately
- Validate error responses for invalid inputs
- Test business logic, not implementation details

**Example**:

```typescript
import { request } from 'supertest';
import { app } from '../index';

describe('POST /api/v1/leads/import', () => {
  it('should import lead with valid data', async () => {
    const response = await request(app)
      .post('/api/v1/leads/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'John Doe',
        email: 'john@example.com',
        source: 'linkedin',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.email).toBe('john@example.com');
  });

  it('should return 401 without authentication', async () => {
    const response = await request(app)
      .post('/api/v1/leads/import')
      .send({ name: 'John Doe' });

    expect(response.status).toBe(401);
  });
});
```

### E2E Testing Guidelines (Playwright)

**File Structure**:
- Place E2E tests in: `apps/web/tests/e2e/`
- Group by feature: `auth.spec.ts`, `leads.spec.ts`, `kanban.spec.ts`

**Test Structure**:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/login');
  });

  test('should do something specific', async ({ page }) => {
    // Arrange
    const testData = { /* test data */ };

    // Act
    await page.fill('#email', testData.email);
    await page.click('button[type="submit"]');

    // Assert
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Welcome');
  });
});
```

**Best Practices**:

- Use page object model or helper functions for reusable actions
- Test user flows, not implementation details
- Use data-testid attributes for reliable element selection
- Test responsive design at different viewport sizes
- Handle async operations with proper waits
- Clean up test data after tests

**Helper Functions** (in `apps/web/tests/helpers/`):

```typescript
// Example helper for authentication
export async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard/**');
}

export function createTestUserData(overrides = {}) {
  return {
    fullName: 'Test User',
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    companyName: 'Test Company',
    ...overrides,
  };
}
```

**Example**:

```typescript
import { test, expect } from '@playwright/test';
import { loginUser, createTestUserData } from '../helpers/auth';

test.describe('User Login', () => {
  test('should login with valid credentials', async ({ page }) => {
    // Arrange
    const userData = createTestUserData({
      email: 'login-test@example.com',
    });

    // Act
    await loginUser(page, userData.email, userData.password);

    // Assert
    await expect(page).toHaveURL('**/dashboard/**');
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessToken).toBeTruthy();
  });
});
```

## Test Data Management

### Database Fixtures

Use test-specific database or transactions:

```typescript
// In vitest setup file
beforeEach(async () => {
  // Start transaction
  await prisma.$transaction([
    prisma.lead.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

afterEach(async () => {
  // Rollback transaction
  await prisma.$rollback();
});
```

### Test Data Builders

Create reusable data builders:

```typescript
// tests/builders/leadBuilder.ts
export function buildLead(overrides = {}) {
  return {
    name: 'Test Lead',
    email: `lead-${Date.now()}@example.com`,
    source: 'linkedin',
    status: 'new',
    ...overrides,
  };
}
```

### Environment-Specific Data

Use environment variables for test configuration:

```env
# .env.test
DATABASE_URL=postgresql://test:test@localhost:5432/test?sslmode=require
DIRECT_URL=postgresql://test:test@localhost:5432/test?sslmode=require
JWT_SECRET=test-secret-key-for-jwt-token-generation-min-32-chars
```

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Pull requests
- Push to main branch
- Manual workflow dispatch

### Test Matrix

Run tests across multiple Node.js versions and operating systems:

```yaml
strategy:
  matrix:
    node-version: [20.x, 21.x]
    os: [ubuntu-latest, windows-latest, macos-latest]
```

### Coverage Reporting

Coverage reports are uploaded to Codecov or similar services:

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
    flags: unittests
```

## Troubleshooting

### Common Issues

**1. Tests fail in CI but pass locally**:
   - Check environment variables are set in CI
   - Ensure database is available and migrations are run
   - Verify test timeouts are appropriate for CI environments
   - Check for timezone or locale differences

**2. Flaky E2E tests**:
   - Use explicit waits instead of fixed timeouts
   - Wait for network idle: `await page.waitForLoadState('networkidle')`
   - Use `page.waitForSelector()` for dynamic content
   - Add retry logic for non-deterministic operations

**3. Database not resetting between tests**:
   - Ensure transactions are properly rolled back
   - Check that test database is separate from development database
   - Verify cleanup in `afterEach` hooks

**4. Coverage not generating**:
   - Ensure `@vitest/coverage-v8` is installed
   - Check that `--coverage` flag is passed to vitest
   - Verify coverage configuration in `vitest.config.ts`

**5. Playwright browsers not installed**:
   ```bash
   npx playwright install
   ```

**6. Port conflicts in tests**:
   - Use dynamic port allocation
   - Set different ports for API in test environment
   - Kill processes holding ports: `lsof -ti:3001 | xargs kill`

### Debug Mode

**Vitest**:
```bash
npm run test --workspace=@lia360/api -- --inspect-brk
```

**Playwright**:
```bash
npm run test --workspace=@lia360/web test:debug
```

## Test Coverage Report Interpretation

### HTML Coverage Report

```bash
# Generate and open coverage report
npm run test:coverage
open apps/api/coverage/index.html
```

### Reading the Report

**Color Coding**:
- **Green**: Fully covered code
- **Red**: Uncovered code
- **Yellow**: Partially covered code

**Metrics**:
- **Statements**: Percentage of executable statements covered
- **Branches**: Percentage of conditional branches covered
- **Functions**: Percentage of functions called
- **Lines**: Percentage of lines executed

### Coverage Thresholds

Configure minimum coverage in `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 75,
    statements: 80,
  },
}
```

### Improving Coverage

1. **Identify Gaps**: Use HTML report to see uncovered lines
2. **Add Tests**: Write tests for uncovered paths
3. **Refactor**: Simplify complex logic that's hard to test
4. **Remove Dead Code**: Delete unreachable code
5. **Mock Dependencies**: Isolate units for better testability

## Performance Testing

### Load Testing

For API performance testing, use tools like:
- **Artillery**: HTTP load testing
- **k6**: Modern load testing tool
- **autocannon**: Node.js HTTP benchmarking

Example script (if available):

```bash
npm run test:performance:scoring
```

### Benchmarking

Measure critical operations:

```typescript
import { bench, describe } from 'vitest';

describe('Scoring Performance', () => {
  bench('should score lead quickly', () => {
    calculateLeadScore(testLeadData);
  });
});
```

## Accessibility Testing

Playwright includes accessibility testing:

```typescript
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test('should be accessible', async ({ page }) => {
  await page.goto('/dashboard/leads');
  await injectAxe(page);
  await checkA11y(page);
});
```

## Security Testing

### API Security Tests

Test for common vulnerabilities:
- SQL injection
- XSS attacks
- CSRF protection
- Authentication bypass
- Authorization checks

```typescript
it('should sanitize input to prevent SQL injection', async () => {
  const maliciousInput = "'; DROP TABLE users; --";
  const response = await request(app)
    .post('/api/v1/leads')
    .send({ name: maliciousInput });

  expect(response.status).not.toBe(500);
});
```

### Input Validation Tests

Ensure Zod schemas are properly validated:

```typescript
import { leadSchema } from '@lia360/shared';

it('should reject invalid lead data', async () => {
  const invalidData = { email: 'not-an-email' };
  const result = leadSchema.safeParse(invalidData);

  expect(result.success).toBe(false);
});
```

## Writing Good Tests

### DO's ✅

- Test behavior, not implementation
- Keep tests simple and focused
- Use descriptive test names
- Test edge cases and error conditions
- Mock external dependencies
- Clean up after tests
- Use page object model for E2E
- Write tests before fixing bugs (TDD)

### DON'Ts ❌

- Don't test private methods
- Don't write brittle tests that break on refactoring
- Don't use fixed timeouts (`waitForTimeout`) when possible
- Don't rely on test execution order
- Don't skip tests without a reason
- Don't test third-party libraries
- Don't write tests that are too complex
- Don't ignore test failures

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [JavaScript Testing Patterns](https://github.com/goldbergyoni/javascript-testing-best-practices)
