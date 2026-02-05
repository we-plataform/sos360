/**
 * Standalone Error Handling Test Script
 *
 * This script tests error handling for the scraping API without requiring Jest.
 * Run it against a running API server at http://localhost:3001
 *
 * Usage:
 * 1. Start the API server: npm run api:dev
 * 2. In a separate terminal: tsx apps/api/src/tests/test-error-handling.ts
 */

import request from 'supertest';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_EMAIL = 'error-test@example.com';
const TEST_PASSWORD = 'Test1234';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

let testCount = 0;
let passCount = 0;
let failCount = 0;

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name: string) {
  testCount++;
  log(`\n[Test ${testCount}] ${name}`, 'blue');
}

function logPass(message: string) {
  passCount++;
  log(`  ✓ ${message}`, 'green');
}

function logFail(message: string) {
  failCount++;
  log(`  ✗ ${message}`, 'red');
}

async function getAuthToken(): Promise<string> {
  const response = await request(`${API_URL}`)
    .post('/api/v1/auth/login')
    .send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

  if (response.status !== 200) {
    throw new Error(`Failed to login: ${JSON.stringify(response.body)}`);
  }

  return response.body.data.accessToken;
}

async function setupTestUser() {
  try {
    await request(`${API_URL}`)
      .post('/api/v1/auth/register')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        fullName: 'Error Test User',
        companyName: 'Test Company',
        workspaceName: 'Test Workspace',
      });
    log('Test user created', 'green');
  } catch (error: unknown) {
    const err = error as { response?: { body?: { error?: string } } };
    if (err.response?.body?.error?.includes('já existe')) {
      log('Test user already exists', 'yellow');
    } else {
      log('Note: Test user setup error (may already exist)', 'yellow');
    }
  }
}

async function main() {
  log('\n═══════════════════════════════════════════════════════════════', 'blue');
  log('  Scraping Error Handling Tests', 'blue');
  log(`  API URL: ${API_URL}`, 'blue');
  log('═══════════════════════════════════════════════════════════════\n', 'blue');

  let authToken: string;

  try {
    await setupTestUser();
    authToken = await getAuthToken();
    logPass('Authentication successful');
  } catch (error) {
    log(`Failed to setup test user: ${(error as Error).message}`, 'red');
    process.exit(1);
  }

  // Test 1: Invalid URL format
  logTest('Reject completely invalid URL');
  try {
    const response = await request(`${API_URL}`)
      .post('/api/v1/scraping/jobs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        urls: ['not-a-valid-url'],
        platform: 'linkedin',
      });

    if (response.status === 400 && response.body.success === false) {
      logPass(`Invalid URL rejected with status ${response.status}`);
      logPass(`Error message: ${response.body.error}`);
    } else {
      logFail(`Expected 400, got ${response.status}`);
    }
  } catch (error) {
    logFail(`Exception: ${(error as Error).message}`);
  }

  // Test 2: URL without protocol
  logTest('Reject URL without protocol');
  try {
    const response = await request(`${API_URL}`)
      .post('/api/v1/scraping/jobs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        urls: ['linkedin.com/in/user'],
        platform: 'linkedin',
      });

    if (response.status === 400 && response.body.success === false) {
      logPass(`URL without protocol rejected with status ${response.status}`);
    } else {
      logFail(`Expected 400, got ${response.status}`);
    }
  } catch (error) {
    logFail(`Exception: ${(error as Error).message}`);
  }

  // Test 3: Multiple invalid URLs
  logTest('Reject multiple invalid URLs');
  try {
    const response = await request(`${API_URL}`)
      .post('/api/v1/scraping/jobs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        urls: ['invalid-1', 'invalid-2', 'https://linkedin.com/in/valid'],
        platform: 'linkedin',
      });

    if (response.status === 400 && response.body.success === false) {
      logPass(`Multiple invalid URLs rejected with status ${response.status}`);
    } else {
      logFail(`Expected 400, got ${response.status}`);
    }
  } catch (error) {
    logFail(`Exception: ${(error as Error).message}`);
  }

  // Test 4: Accept valid URLs
  logTest('Accept valid LinkedIn URLs');
  try {
    const response = await request(`${API_URL}`)
      .post('/api/v1/scraping/jobs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        urls: ['https://www.linkedin.com/in/testuser/', 'https://linkedin.com/in/another-user'],
        platform: 'linkedin',
      });

    if (response.status === 201 && response.body.success === true) {
      logPass(`Valid URLs accepted with status ${response.status}`);
      logPass(`Job ID: ${response.body.data.id}`);
      logPass(`Job status: ${response.body.data.status}`);
    } else {
      logFail(`Expected 201, got ${response.status}`);
    }
  } catch (error) {
    logFail(`Exception: ${(error as Error).message}`);
  }

  // Test 5: Invalid platform
  logTest('Reject invalid platform');
  try {
    const response = await request(`${API_URL}`)
      .post('/api/v1/scraping/jobs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        urls: ['https://linkedin.com/in/test'],
        platform: 'unknown-platform',
      });

    if (response.status === 400 && response.body.success === false) {
      logPass(`Invalid platform rejected with status ${response.status}`);
      logPass(`Error message: ${response.body.error}`);
    } else {
      logFail(`Expected 400, got ${response.status}`);
    }
  } catch (error) {
    logFail(`Exception: ${(error as Error).message}`);
  }

  // Test 6: Empty URL array
  logTest('Reject empty URL array');
  try {
    const response = await request(`${API_URL}`)
      .post('/api/v1/scraping/jobs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        urls: [],
        platform: 'linkedin',
      });

    if (response.status === 400 && response.body.success === false) {
      logPass(`Empty URL array rejected with status ${response.status}`);
    } else {
      logFail(`Expected 400, got ${response.status}`);
    }
  } catch (error) {
    logFail(`Exception: ${(error as Error).message}`);
  }

  // Test 7: Too many URLs (>100)
  logTest('Reject more than 100 URLs');
  try {
    const urls = Array.from({ length: 101 }, (_, i) => `https://linkedin.com/in/user${i}`);
    const response = await request(`${API_URL}`)
      .post('/api/v1/scraping/jobs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ urls, platform: 'linkedin' });

    if (response.status === 400 && response.body.success === false) {
      logPass(`More than 100 URLs rejected with status ${response.status}`);
    } else {
      logFail(`Expected 400, got ${response.status}`);
    }
  } catch (error) {
    logFail(`Exception: ${(error as Error).message}`);
  }

  // Test 8: Rate limiting - make 10 requests
  logTest('Allow up to 10 requests per minute');
  try {
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(
        request(`${API_URL}`)
          .post('/api/v1/scraping/jobs')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            urls: [`https://linkedin.com/in/testuser${i}`],
            platform: 'linkedin',
          })
      );
    }

    const responses = await Promise.all(requests);
    const successCount = responses.filter((r) => r.status === 201).length;

    if (successCount === 10) {
      logPass(`All 10 requests allowed (${successCount}/201)`);
    } else {
      logFail(`Expected 10 successes, got ${successCount}`);
    }
  } catch (error) {
    logFail(`Exception: ${(error as Error).message}`);
  }

  // Test 9: Rate limiting - 11th request
  logTest('Reject 11th request with 429 status');
  try {
    // First, exhaust the limit
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(
        request(`${API_URL}`)
          .post('/api/v1/scraping/jobs')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            urls: [`https://linkedin.com/in/rateuser${i}`],
            platform: 'linkedin',
          })
      );
    }
    await Promise.all(requests);

    // 11th request
    const response = await request(`${API_URL}`)
      .post('/api/v1/scraping/jobs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        urls: ['https://linkedin.com/in/rateuser11'],
        platform: 'linkedin',
      });

    if (response.status === 429 && response.body.success === false) {
      logPass(`11th request rejected with status ${response.status}`);
      logPass(`Rate limit headers present:`, 'reset');
      log(`    - RateLimit-Limit: ${response.headers['ratelimit-limit']}`, 'reset');
      log(`    - RateLimit-Remaining: ${response.headers['ratelimit-remaining']}`, 'reset');
      log(`    - RateLimit-Reset: ${response.headers['ratelimit-reset']}`, 'reset');
    } else {
      logFail(`Expected 429, got ${response.status}`);
    }
  } catch (error) {
    logFail(`Exception: ${(error as Error).message}`);
  }

  // Test 10: No authentication
  logTest('Reject request without authentication');
  try {
    const response = await request(`${API_URL}`)
      .post('/api/v1/scraping/jobs')
      .send({
        urls: ['https://linkedin.com/in/test'],
        platform: 'linkedin',
      });

    if (response.status === 401 && response.body.success === false) {
      logPass(`Unauthenticated request rejected with status ${response.status}`);
    } else {
      logFail(`Expected 401, got ${response.status}`);
    }
  } catch (error) {
    logFail(`Exception: ${(error as Error).message}`);
  }

  // Test 11: Job not found
  logTest('Return 404 for non-existent job');
  try {
    const response = await request(`${API_URL}`)
      .get('/api/v1/scraping/jobs/non-existent-job-id')
      .set('Authorization', `Bearer ${authToken}`);

    if (response.status === 404 && response.body.success === false) {
      logPass(`Non-existent job returns status ${response.status}`);
    } else {
      logFail(`Expected 404, got ${response.status}`);
    }
  } catch (error) {
    logFail(`Exception: ${(error as Error).message}`);
  }

  // Test 12: Valid platform
  logTest('Accept valid platforms');
  const validPlatforms = ['linkedin', 'instagram', 'facebook', 'twitter', 'x'];
  for (const platform of validPlatforms) {
    try {
      const response = await request(`${API_URL}`)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: [`https://linkedin.com/in/test${platform}`],
          platform,
        });

      if (response.status === 201) {
        logPass(`Platform "${platform}" accepted`);
      } else {
        logFail(`Platform "${platform}" rejected with status ${response.status}`);
      }
    } catch (error) {
      logFail(`Platform "${platform}" threw exception: ${(error as Error).message}`);
    }
  }

  // Print summary
  log('\n═══════════════════════════════════════════════════════════════', 'blue');
  log('  Test Summary', 'blue');
  log('═══════════════════════════════════════════════════════════════\n', 'blue');
  log(`Total tests: ${testCount}`, 'blue');
  log(`Passed: ${passCount}`, 'green');
  log(`Failed: ${failCount}`, failCount > 0 ? 'red' : 'green');
  log(`Success rate: ${((passCount / testCount) * 100).toFixed(1)}%\n`, passCount === testCount ? 'green' : 'yellow');

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\nFatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
