/**
 * Scraping Error Handling Tests
 *
 * This test suite verifies error handling for:
 * 1. Invalid URL format validation
 * 2. Profile not found errors
 * 3. Rate limiting (429 responses)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { prisma, ScrapingJobStatus } from '@lia360/database';
import { createTestServer, TestServer } from '../lib/test/test-server.js';
import { createTestUser, generateAuthToken } from '../lib/test/test-helpers.js';

describe('Scraping Error Handling', () => {
  let server: TestServer;
  let authToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    server = await createTestServer();

    // Create test user and get auth token
    const testUser = await createTestUser({
      email: 'scraping-test@example.com',
      role: 'admin',
    });
    authToken = generateAuthToken(testUser);
    workspaceId = testUser.workspaceId;
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    // Clean up scraping jobs before each test
    await prisma.scrapingJob.deleteMany({
      where: { workspaceId },
    });
  });

  describe('Invalid URL Format Validation', () => {
    it('should reject job with completely invalid URL', async () => {
      const response = await request(server.app)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: ['not-a-valid-url'],
          platform: 'linkedin',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('URL inválida');
    });

    it('should reject job with URL missing protocol', async () => {
      const response = await request(server.app)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: ['linkedin.com/in/someuser'],
          platform: 'linkedin',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('URL inválida');
    });

    it('should reject job with multiple invalid URLs', async () => {
      const response = await request(server.app)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: [
            'not-a-url',
            'another-invalid',
            'https://linkedin.com/in/validuser',
          ],
          platform: 'linkedin',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('URL inválida');
    });

    it('should accept job with valid LinkedIn URLs', async () => {
      const response = await request(server.app)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: [
            'https://www.linkedin.com/in/testuser/',
            'https://linkedin.com/in/another-user',
          ],
          platform: 'linkedin',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.status).toBe('pending');
    });
  });

  describe('Invalid Platform Validation', () => {
    it('should reject job with invalid platform', async () => {
      const response = await request(server.app)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: ['https://linkedin.com/in/testuser'],
          platform: 'unknown-platform',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Plataforma inválida');
    });

    it('should reject job with missing platform', async () => {
      const response = await request(server.app)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: ['https://linkedin.com/in/testuser'],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('URL Array Validation', () => {
    it('should reject job with empty URL array', async () => {
      const response = await request(server.app)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: [],
          platform: 'linkedin',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject job with more than 100 URLs', async () => {
      const urls = Array.from({ length: 101 }, (_, i) => `https://linkedin.com/in/user${i}`);

      const response = await request(server.app)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls,
          platform: 'linkedin',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Profile Not Found Error Handling', () => {
    it('should handle non-existent profile gracefully', async () => {
      // Create a job with a URL that doesn't exist
      const createResponse = await request(server.app)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: ['https://linkedin.com/in/nonexistentuser123456789'],
          platform: 'linkedin',
        })
        .expect(201);

      const jobId = createResponse.body.data.id;

      // Wait for job to be processed (simulate worker processing)
      // In a real scenario, the BullMQ worker would process this
      // For this test, we'll manually update the job to simulate failure
      await prisma.scrapingJob.update({
        where: { id: jobId },
        data: {
          status: 'failed' as ScrapingJobStatus,
          errors: {
            'https://linkedin.com/in/nonexistentuser123456789': 'Profile not found or failed to load',
          } as unknown as Record<string, unknown>,
        },
      });

      // Verify job shows as failed with error
      const jobResponse = await request(server.app)
        .get(`/api/v1/scraping/jobs/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(jobResponse.body.data.status).toBe('failed');
      expect(jobResponse.body.data.errors).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should allow up to 10 scraping job submissions per minute', async () => {
      const requests = [];

      // Submit 10 jobs rapidly (should all succeed)
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(server.app)
            .post('/api/v1/scraping/jobs')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              urls: [`https://linkedin.com/in/testuser${i}`],
              platform: 'linkedin',
            })
        );
      }

      const responses = await Promise.all(requests);

      // All 10 should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
    });

    it('should reject 11th request with 429 status', async () => {
      const requests = [];

      // Submit 10 jobs (should succeed)
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(server.app)
            .post('/api/v1/scraping/jobs')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              urls: [`https://linkedin.com/in/testuser${i}`],
              platform: 'linkedin',
            })
        );
      }

      await Promise.all(requests);

      // 11th request should be rate limited
      const response = await request(server.app)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: ['https://linkedin.com/in/testuser11'],
          platform: 'linkedin',
        })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error.type).toBe('rate_limited');
      expect(response.body.error.status).toBe(429);
    });

    it('should include retry-after header in rate limit response', async () => {
      // First, exhaust the rate limit
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(server.app)
            .post('/api/v1/scraping/jobs')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              urls: [`https://linkedin.com/in/testuser${i}`],
              platform: 'linkedin',
            })
        );
      }
      await Promise.all(requests);

      // Check rate limit response
      const response = await request(server.app)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urls: ['https://linkedin.com/in/testuser11'],
          platform: 'linkedin',
        })
        .expect(429);

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('Authentication Required', () => {
    it('should reject job submission without authentication', async () => {
      const response = await request(server.app)
        .post('/api/v1/scraping/jobs')
        .send({
          urls: ['https://linkedin.com/in/testuser'],
          platform: 'linkedin',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject job status check without authentication', async () => {
      const response = await request(server.app)
        .get('/api/v1/scraping/jobs/some-job-id')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject job list without authentication', async () => {
      const response = await request(server.app)
        .get('/api/v1/scraping/jobs')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Authorization Required', () => {
    it('should reject job submission from non-admin user', async () => {
      // Create a viewer user
      const viewerUser = await createTestUser({
        email: 'viewer@example.com',
        role: 'viewer',
      });
      const viewerToken = generateAuthToken(viewerUser);

      const response = await request(server.app)
        .post('/api/v1/scraping/jobs')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          urls: ['https://linkedin.com/in/testuser'],
          platform: 'linkedin',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Job Not Found Errors', () => {
    it('should return 404 for non-existent job', async () => {
      const fakeJobId = 'non-existent-job-id';

      const response = await request(server.app)
        .get(`/api/v1/scraping/jobs/${fakeJobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });
});
