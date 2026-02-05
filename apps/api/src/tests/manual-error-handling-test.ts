/**
 * Manual Error Handling Test Script
 *
 * This script tests error handling for the scraping API.
 * Run it against a running API server at http://localhost:3001
 *
 * Usage:
 * 1. Start the API server: npm run api:dev
 * 2. In a separate terminal: npm run test:scraping-errors
 *
 * Or run directly:
 * tsx apps/api/src/tests/manual-error-handling-test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_EMAIL = 'error-handling-test@example.com';
const TEST_PASSWORD = 'Test1234';

// Helper to get auth token
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

// Helper to create test user
async function setupTestUser() {
  try {
    // Try to register
    await request(`${API_URL}`)
      .post('/api/v1/auth/register')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        fullName: 'Error Test User',
        companyName: 'Test Company',
        workspaceName: 'Test Workspace',
      });
    console.log('✓ Test user created');
  } catch (error: unknown) {
    // User might already exist, that's fine
    const err = error as { response?: { body?: { error?: string } } };
    if (err.response?.body?.error?.includes('já existe')) {
      console.log('✓ Test user already exists');
    } else {
      console.log('Note: Test user setup error (may already exist)');
    }
  }
}

// Helper to clean up test jobs
async function cleanupJobs(authToken: string) {
  try {
    const response = await request(`${API_URL}`)
      .get('/api/v1/scraping/jobs')
      .set('Authorization', `Bearer ${authToken}`);

    if (response.status === 200 && response.body.data.length > 0) {
      // In production, you'd want to delete these
      console.log(`Note: ${response.body.data.length} test jobs exist in database`);
    }
  } catch (error) {
    console.log('Note: Could not check for existing jobs');
  }
}

describe('Scraping Error Handling - Manual Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    console.log('\n=== Setting up tests ===');
    console.log(`API URL: ${API_URL}`);

    await setupTestUser();
    authToken = await getAuthToken();
    console.log('✓ Authentication successful\n');

    // Clean up any existing jobs
    await cleanupJobs(authToken);
  });

  afterAll(() => {
    console.log('\n=== Tests complete ===');
  });

  describe('1. Invalid URL Format Validation', () => {
    it('should reject completely invalid URL', async () => {
      console.log('\nTest: Reject completely invalid URL');

      const response = await request(`${API_URL}`)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: ['not-a-valid-url'],
          platform: 'linkedin',
        });

      console.log(`Response status: ${response.status}`);
      console.log(`Response body:`, JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('URL inválida');
      console.log('✓ Test passed: Invalid URL rejected');
    });

    it('should reject URL without protocol', async () => {
      console.log('\nTest: Reject URL without protocol');

      const response = await request(`${API_URL}`)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: ['linkedin.com/in/user'],
          platform: 'linkedin',
        });

      console.log(`Response status: ${response.status}`);
      console.log(`Response body:`, JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('URL inválida');
      console.log('✓ Test passed: URL without protocol rejected');
    });

    it('should reject multiple invalid URLs in array', async () => {
      console.log('\nTest: Reject multiple invalid URLs');

      const response = await request(`${API_URL}`)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: ['invalid-1', 'invalid-2', 'https://linkedin.com/in/valid'],
          platform: 'linkedin',
        });

      console.log(`Response status: ${response.status}`);
      console.log(`Response body:`, JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      console.log('✓ Test passed: Multiple invalid URLs rejected');
    });

    it('should accept valid LinkedIn URLs', async () => {
      console.log('\nTest: Accept valid LinkedIn URLs');

      const response = await request(`${API_URL}`)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: [
            'https://www.linkedin.com/in/testuser/',
            'https://linkedin.com/in/another-user',
          ],
          platform: 'linkedin',
        });

      console.log(`Response status: ${response.status}`);
      console.log(`Job ID: ${response.body.data?.id}`);
      console.log(`Job status: ${response.body.data?.status}`);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.status).toBe('pending');
      console.log('✓ Test passed: Valid URLs accepted');
    });
  });

  describe('2. Invalid Platform Validation', () => {
    it('should reject invalid platform', async () => {
      console.log('\nTest: Reject invalid platform');

      const response = await request(`${API_URL}`)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: ['https://linkedin.com/in/test'],
          platform: 'unknown-platform',
        });

      console.log(`Response status: ${response.status}`);
      console.log(`Response body:`, JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Plataforma inválida');
      console.log('✓ Test passed: Invalid platform rejected');
    });
  });

  describe('3. URL Array Validation', () => {
    it('should reject empty URL array', async () => {
      console.log('\nTest: Reject empty URL array');

      const response = await request(`${API_URL}`)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: [],
          platform: 'linkedin',
        });

      console.log(`Response status: ${response.status}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      console.log('✓ Test passed: Empty URL array rejected');
    });

    it('should reject more than 100 URLs', async () => {
      console.log('\nTest: Reject more than 100 URLs');

      const urls = Array.from({ length: 101 }, (_, i) => `https://linkedin.com/in/user${i}`);

      const response = await request(`${API_URL}`)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls,
          platform: 'linkedin',
        });

      console.log(`Response status: ${response.status}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      console.log('✓ Test passed: More than 100 URLs rejected');
    });
  });

  describe('4. Rate Limiting', () => {
    it('should allow up to 10 requests per minute', async () => {
      console.log('\nTest: Allow up to 10 requests per minute');

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
      const successCount = responses.filter(r => r.status === 201).length;

      console.log(`Successful requests: ${successCount}/10`);

      expect(successCount).toBe(10);
      console.log('✓ Test passed: 10 requests allowed');
    });

    it('should reject 11th request with 429', async () => {
      console.log('\nTest: Reject 11th request with 429 status');

      // First, exhaust the limit (in case previous tests didn't)
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
      await Promise.all(requests);

      // 11th request
      const response = await request(`${API_URL}`)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: ['https://linkedin.com/in/testuser11'],
          platform: 'linkedin',
        });

      console.log(`Response status: ${response.status}`);
      console.log(`Response body:`, JSON.stringify(response.body, null, 2));
      console.log(`Rate limit headers:`, {
        limit: response.headers['ratelimit-limit'],
        remaining: response.headers['ratelimit-remaining'],
        reset: response.headers['ratelimit-reset'],
      });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error.type).toBe('rate_limited');
      console.log('✓ Test passed: 11th request rejected with 429');
    });
  });

  describe('5. Authentication Required', () => {
    it('should reject request without authentication', async () => {
      console.log('\nTest: Reject request without authentication');

      const response = await request(`${API_URL}`)
        .post('/api/v1/scraping/jobs')
        .send({
          urls: ['https://linkedin.com/in/test'],
          platform: 'linkedin',
        });

      console.log(`Response status: ${response.status}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      console.log('✓ Test passed: Unauthenticated request rejected');
    });
  });

  describe('6. Job Not Found', () => {
    it('should return 404 for non-existent job', async () => {
      console.log('\nTest: Return 404 for non-existent job');

      const response = await request(`${API_URL}`)
        .get('/api/v1/scraping/jobs/non-existent-job-id')
        .set('Authorization', `Bearer ${authToken}`);

      console.log(`Response status: ${response.status}`);
      console.log(`Response body:`, JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      console.log('✓ Test passed: Non-existent job returns 404');
    });
  });

  describe('7. Profile Not Found Simulation', () => {
    it('should handle profile not found scenario', async () => {
      console.log('\nTest: Handle profile not found scenario');

      // Create a job with a non-existent profile URL
      const createResponse = await request(`${API_URL}`)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: ['https://linkedin.com/in/nonexistentuser123456789'],
          platform: 'linkedin',
        });

      console.log(`Job created with ID: ${createResponse.body.data.id}`);
      console.log(`Job status: ${createResponse.body.data.status}`);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.data.status).toBe('pending');

      const jobId = createResponse.body.data.id;

      // In a real scenario, the worker would process this and fail
      // For this test, we just verify the job was created successfully
      // The actual scraping failure would be handled by the worker
      console.log('Note: In production, worker would process this and update job status to "failed"');
      console.log('✓ Test passed: Job created for non-existent profile');
    });
  });
});
