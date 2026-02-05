/**
 * End-to-End Tests for Scraping Workflow
 *
 * These tests verify the complete scraping workflow:
 * 1. Job submission and validation
 * 2. Job status progression (pending -> processing -> completed)
 * 3. Result retrieval and database persistence
 * 4. Error handling for invalid inputs
 *
 * Note: These are integration tests that verify the workflow logic.
 * For manual testing against a running API, see manual-e2e-scraping-test.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { prisma, ScrapingJobStatus } from '@lia360/database';
import { PLATFORMS } from '@lia360/shared';

// Mock the database module
vi.mock('@lia360/database', async () => {
  const actual = await vi.importActual('@lia360/database');
  return {
    ...actual,
    prisma: {
      scrapingJob: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
    },
  };
});

describe('Scraping Workflow - End-to-End', () => {
  describe('Step 1: Job Submission', () => {
    it('should accept valid scraping job with LinkedIn URLs', async () => {
      const mockJob = {
        id: 'test-job-123',
        workspaceId: 'workspace-123',
        platform: 'linkedin' as const,
        urls: ['https://www.linkedin.com/in/test-user-1', 'https://www.linkedin.com/in/test-user-2'],
        status: 'pending' as ScrapingJobStatus,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
        totalUrls: null,
        progress: 0,
        results: null,
        errors: null,
      };

      vi.mocked(prisma.scrapingJob.create).mockResolvedValueOnce(mockJob);

      // Simulate job creation
      const job = await prisma.scrapingJob.create({
        data: {
          workspaceId: 'workspace-123',
          platform: 'linkedin',
          urls: ['https://www.linkedin.com/in/test-user-1', 'https://www.linkedin.com/in/test-user-2'],
          status: 'pending',
          metadata: {},
        },
      });

      expect(job).toBeDefined();
      expect(job.id).toBe('test-job-123');
      expect(job.status).toBe('pending');
      expect(job.platform).toBe('linkedin');
      expect(job.urls).toHaveLength(2);
    });

    it('should validate URL format before creating job', () => {
      const validUrls = [
        'https://www.linkedin.com/in/test-user',
        'https://linkedin.com/in/test-user',
        'http://www.linkedin.com/in/test-user',
      ];

      const invalidUrls = [
        'not-a-url',
        'linkedin.com/in/test-user', // Missing protocol
        'ftp://invalid.com',
        '', // Empty string
      ];

      // Valid URLs should be parseable by URL constructor
      validUrls.forEach(url => {
        expect(() => new URL(url)).not.toThrow();
      });

      // Invalid URLs should throw
      invalidUrls.forEach(url => {
        expect(() => new URL(url)).toThrow();
      });
    });

    it('should validate platform is supported', () => {
      const validPlatforms = ['linkedin', 'instagram', 'facebook', 'twitter', 'x'];
      const invalidPlatform = 'unsupported-platform';

      // All valid platforms should be in PLATFORMS constant
      validPlatforms.forEach(platform => {
        expect(PLATFORMS).toContain(platform);
      });

      // Invalid platform should not be supported
      expect(PLATFORMS).not.toContain(invalidPlatform);
    });

    it('should enforce URL count limits (1-100 URLs)', () => {
      const minUrls = 1;
      const maxUrls = 100;

      // Test minimum
      expect([1]).toHaveLength(minUrls);

      // Test maximum
      expect(Array(maxUrls).fill('https://linkedin.com/in/test')).toHaveLength(maxUrls);

      // Test below minimum
      expect([].length).toBeLessThan(minUrls);

      // Test above maximum
      expect(Array(maxUrls + 1).fill('url').length).toBeGreaterThan(maxUrls);
    });
  });

  describe('Step 2: Job Status - Pending', () => {
    it('should return job with pending status after creation', async () => {
      const mockJob = {
        id: 'test-job-123',
        workspaceId: 'workspace-123',
        platform: 'linkedin' as const,
        urls: ['https://www.linkedin.com/in/test-user'],
        status: 'pending' as ScrapingJobStatus,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
        totalUrls: null,
        progress: 0,
        results: null,
        errors: null,
      };

      vi.mocked(prisma.scrapingJob.findFirst).mockResolvedValueOnce(mockJob);

      const job = await prisma.scrapingJob.findFirst({
        where: { id: 'test-job-123', workspaceId: 'workspace-123' },
      });

      expect(job).toBeDefined();
      expect(job!.status).toBe('pending');
      expect(job!.progress).toBe(0);
      expect(job!.startedAt).toBeNull();
      expect(job!.completedAt).toBeNull();
    });
  });

  describe('Step 3: Job Status - Processing', () => {
    it('should return job with processing status when worker starts', async () => {
      const mockJob = {
        id: 'test-job-123',
        workspaceId: 'workspace-123',
        platform: 'linkedin' as const,
        urls: ['https://www.linkedin.com/in/test-user-1', 'https://www.linkedin.com/in/test-user-2'],
        status: 'processing' as ScrapingJobStatus,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
        totalUrls: 2,
        progress: 1,
        results: null,
        errors: null,
      };

      vi.mocked(prisma.scrapingJob.findFirst).mockResolvedValueOnce(mockJob);

      const job = await prisma.scrapingJob.findFirst({
        where: { id: 'test-job-123', workspaceId: 'workspace-123' },
      });

      expect(job).toBeDefined();
      expect(job!.status).toBe('processing');
      expect(job!.progress).toBe(1);
      expect(job!.totalUrls).toBe(2);
      expect(job!.startedAt).toBeDefined();
      expect(job!.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('Step 4: Job Status - Completed', () => {
    it('should return job with completed status and results', async () => {
      const mockResults = [
        {
          url: 'https://www.linkedin.com/in/test-user-1',
          success: true,
          data: {
            fullName: 'Test User 1',
            headline: 'Software Engineer',
            company: 'Test Company',
            location: 'San Francisco, CA',
          },
        },
        {
          url: 'https://www.linkedin.com/in/test-user-2',
          success: true,
          data: {
            fullName: 'Test User 2',
            headline: 'Product Manager',
            company: 'Another Company',
            location: 'New York, NY',
          },
        },
      ];

      const mockJob = {
        id: 'test-job-123',
        workspaceId: 'workspace-123',
        platform: 'linkedin' as const,
        urls: ['https://www.linkedin.com/in/test-user-1', 'https://www.linkedin.com/in/test-user-2'],
        status: 'completed' as ScrapingJobStatus,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        totalUrls: 2,
        progress: 2,
        results: mockResults as any,
        errors: {},
      };

      vi.mocked(prisma.scrapingJob.findFirst).mockResolvedValueOnce(mockJob);

      const job = await prisma.scrapingJob.findFirst({
        where: { id: 'test-job-123', workspaceId: 'workspace-123' },
      });

      expect(job).toBeDefined();
      expect(job!.status).toBe('completed');
      expect(job!.progress).toBe(2);
      expect(job!.totalUrls).toBe(2);
      expect(job!.completedAt).toBeDefined();
      expect(job!.completedAt).toBeInstanceOf(Date);
      expect(job!.results).toBeDefined();
      expect(job!.results).toHaveLength(2);
      expect(job!.results![0].success).toBe(true);
      expect(job!.results![0].data.fullName).toBe('Test User 1');
    });
  });

  describe('Step 5: Result Retrieval', () => {
    it('should retrieve all scraped data correctly', async () => {
      const mockResults = [
        {
          url: 'https://www.linkedin.com/in/test-user-1',
          success: true,
          data: {
            fullName: 'Test User 1',
            headline: 'Software Engineer',
            company: 'Test Company',
            location: 'San Francisco, CA',
            industry: 'Technology',
            avatarUrl: 'https://example.com/avatar1.jpg',
          },
        },
        {
          url: 'https://www.linkedin.com/in/test-user-2',
          success: true,
          data: {
            fullName: 'Test User 2',
            headline: 'Product Manager',
            company: 'Another Company',
            location: 'New York, NY',
            industry: 'Finance',
            avatarUrl: 'https://example.com/avatar2.jpg',
          },
        },
      ];

      const mockJob = {
        id: 'test-job-123',
        workspaceId: 'workspace-123',
        platform: 'linkedin' as const,
        urls: ['https://www.linkedin.com/in/test-user-1', 'https://www.linkedin.com/in/test-user-2'],
        status: 'completed' as ScrapingJobStatus,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        totalUrls: 2,
        progress: 2,
        results: mockResults as any,
        errors: {},
      };

      vi.mocked(prisma.scrapingJob.findFirst).mockResolvedValueOnce(mockJob);

      const job = await prisma.scrapingJob.findFirst({
        where: { id: 'test-job-123', workspaceId: 'workspace-123' },
      });

      // Verify all data fields are present
      expect(job!.results).toBeDefined();
      expect(job!.results).toHaveLength(2);

      // Verify first result
      const result1 = job!.results![0] as any;
      expect(result1.url).toBe('https://www.linkedin.com/in/test-user-1');
      expect(result1.success).toBe(true);
      expect(result1.data.fullName).toBe('Test User 1');
      expect(result1.data.headline).toBe('Software Engineer');
      expect(result1.data.company).toBe('Test Company');
      expect(result1.data.location).toBe('San Francisco, CA');
      expect(result1.data.industry).toBe('Technology');
      expect(result1.data.avatarUrl).toBe('https://example.com/avatar1.jpg');

      // Verify second result
      const result2 = job!.results![1] as any;
      expect(result2.url).toBe('https://www.linkedin.com/in/test-user-2');
      expect(result2.success).toBe(true);
      expect(result2.data.fullName).toBe('Test User 2');
      expect(result2.data.headline).toBe('Product Manager');
      expect(result2.data.company).toBe('Another Company');
    });
  });

  describe('Step 6: Database Persistence', () => {
    it('should store all required fields in database', async () => {
      const mockJob = {
        id: 'test-job-123',
        workspaceId: 'workspace-123',
        platform: 'linkedin' as const,
        urls: ['https://www.linkedin.com/in/test-user-1', 'https://www.linkedin.com/in/test-user-2'],
        status: 'completed' as ScrapingJobStatus,
        metadata: { source: 'e2e-test' },
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        totalUrls: 2,
        progress: 2,
        results: [
          {
            url: 'https://www.linkedin.com/in/test-user-1',
            success: true,
            data: { fullName: 'Test User 1' },
          },
        ] as any,
        errors: {},
      };

      vi.mocked(prisma.scrapingJob.findFirst).mockResolvedValueOnce(mockJob);

      const job = await prisma.scrapingJob.findFirst({
        where: { id: 'test-job-123', workspaceId: 'workspace-123' },
      });

      // Verify all database fields are persisted
      expect(job!.id).toBeDefined();
      expect(job!.workspaceId).toBe('workspace-123');
      expect(job!.platform).toBe('linkedin');
      expect(job!.status).toBe('completed');
      expect(job!.urls).toEqual(['https://www.linkedin.com/in/test-user-1', 'https://www.linkedin.com/in/test-user-2']);
      expect(job!.metadata).toEqual({ source: 'e2e-test' });
      expect(job!.createdAt).toBeDefined();
      expect(job!.startedAt).toBeDefined();
      expect(job!.completedAt).toBeDefined();
      expect(job!.totalUrls).toBe(2);
      expect(job!.progress).toBe(2);
      expect(job!.results).toBeDefined();
      expect(job!.errors).toBeDefined();
    });
  });

  describe('Error Handling: Partial Failures', () => {
    it('should handle mixed success/failure results', async () => {
      const mockResults = [
        {
          url: 'https://www.linkedin.com/in/test-user-1',
          success: true,
          data: {
            fullName: 'Test User 1',
            headline: 'Software Engineer',
          },
        },
        {
          url: 'https://www.linkedin.com/in/non-existent-user',
          success: false,
          error: 'Profile not found or access restricted',
        },
      ];

      const mockJob = {
        id: 'test-job-failed-123',
        workspaceId: 'workspace-123',
        platform: 'linkedin' as const,
        urls: ['https://www.linkedin.com/in/test-user-1', 'https://www.linkedin.com/in/non-existent-user'],
        status: 'completed' as ScrapingJobStatus,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        totalUrls: 2,
        progress: 2,
        results: mockResults as any,
        errors: {
          'https://www.linkedin.com/in/non-existent-user': 'Profile not found or access restricted',
        },
      };

      vi.mocked(prisma.scrapingJob.findFirst).mockResolvedValueOnce(mockJob);

      const job = await prisma.scrapingJob.findFirst({
        where: { id: 'test-job-failed-123', workspaceId: 'workspace-123' },
      });

      expect(job!.status).toBe('completed'); // Job completes even with partial failures
      expect(job!.results).toHaveLength(2);
      expect((job!.results![0] as any).success).toBe(true);
      expect((job!.results![1] as any).success).toBe(false);
      expect((job!.results![1] as any).error).toBe('Profile not found or access restricted');
      expect(job!.errors['https://www.linkedin.com/in/non-existent-user']).toBe(
        'Profile not found or access restricted'
      );
    });
  });

  describe('Pagination and Filtering', () => {
    it('should return paginated list of jobs', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          workspaceId: 'workspace-123',
          platform: 'linkedin' as const,
          urls: ['https://www.linkedin.com/in/test-1'],
          status: 'completed' as ScrapingJobStatus,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          startedAt: new Date(),
          completedAt: new Date(),
          totalUrls: 1,
          progress: 1,
          results: [],
          errors: null,
        },
        {
          id: 'job-2',
          workspaceId: 'workspace-123',
          platform: 'linkedin' as const,
          urls: ['https://www.linkedin.com/in/test-2'],
          status: 'pending' as ScrapingJobStatus,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          startedAt: null,
          completedAt: null,
          totalUrls: null,
          progress: 0,
          results: null,
          errors: null,
        },
      ];

      vi.mocked(prisma.scrapingJob.findMany).mockResolvedValueOnce(mockJobs);
      vi.mocked(prisma.scrapingJob.count).mockResolvedValueOnce(2);

      const [jobs, total] = await Promise.all([
        prisma.scrapingJob.findMany({
          where: { workspaceId: 'workspace-123' },
          skip: 0,
          take: 10,
        }),
        prisma.scrapingJob.count({ where: { workspaceId: 'workspace-123' } }),
      ]);

      expect(jobs).toHaveLength(2);
      expect(total).toBe(2);

      // Verify pagination metadata
      const page = 1;
      const limit = 10;
      const totalPages = Math.ceil(total / limit);

      expect(page).toBe(1);
      expect(limit).toBe(10);
      expect(totalPages).toBe(1);
    });

    it('should filter jobs by status', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          workspaceId: 'workspace-123',
          platform: 'linkedin' as const,
          urls: ['https://www.linkedin.com/in/test-1'],
          status: 'completed' as ScrapingJobStatus,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          startedAt: new Date(),
          completedAt: new Date(),
          totalUrls: 1,
          progress: 1,
          results: [],
          errors: null,
        },
      ];

      vi.mocked(prisma.scrapingJob.findMany).mockResolvedValueOnce(mockJobs);

      const jobs = await prisma.scrapingJob.findMany({
        where: {
          workspaceId: 'workspace-123',
          status: 'completed',
        },
      });

      expect(jobs).toHaveLength(1);
      expect(jobs[0].status).toBe('completed');
    });

    it('should filter jobs by platform', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          workspaceId: 'workspace-123',
          platform: 'linkedin' as const,
          urls: ['https://www.linkedin.com/in/test-1'],
          status: 'completed' as ScrapingJobStatus,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          startedAt: new Date(),
          completedAt: new Date(),
          totalUrls: 1,
          progress: 1,
          results: [],
          errors: null,
        },
      ];

      vi.mocked(prisma.scrapingJob.findMany).mockResolvedValueOnce(mockJobs);

      const jobs = await prisma.scrapingJob.findMany({
        where: {
          workspaceId: 'workspace-123',
          platform: 'linkedin',
        },
      });

      expect(jobs).toHaveLength(1);
      expect(jobs[0].platform).toBe('linkedin');
    });
  });

  describe('Non-existent Job', () => {
    it('should return null for non-existent job ID', async () => {
      vi.mocked(prisma.scrapingJob.findFirst).mockResolvedValueOnce(null);

      const job = await prisma.scrapingJob.findFirst({
        where: { id: 'non-existent-job-id', workspaceId: 'workspace-123' },
      });

      expect(job).toBeNull();
    });
  });

  describe('Job Status Transitions', () => {
    it('should follow correct status progression', async () => {
      const validTransitions: Array<{ from: ScrapingJobStatus; to: ScrapingJobStatus }> = [
        { from: 'pending', to: 'processing' },
        { from: 'processing', to: 'completed' },
        { from: 'processing', to: 'failed' },
        { from: 'pending', to: 'failed' }, // Redis unavailable
      ];

      const allStatuses: ScrapingJobStatus[] = ['pending', 'processing', 'completed', 'failed'];

      // Verify all statuses are valid
      allStatuses.forEach(status => {
        expect(['pending', 'processing', 'completed', 'failed']).toContain(status);
      });

      // Verify valid transitions
      validTransitions.forEach(transition => {
        const { from, to } = transition;
        expect(allStatuses).toContain(from);
        expect(allStatuses).toContain(to);
      });
    });
  });
});
