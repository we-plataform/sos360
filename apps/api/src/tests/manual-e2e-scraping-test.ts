/**
 * Manual End-to-End Test for Scraping Workflow
 *
 * This script tests the complete scraping workflow by making real API calls.
 * It requires:
 * 1. API server running on http://localhost:3001
 * 2. Valid authentication token
 * 3. Redis running (for queue)
 *
 * Usage:
 *   tsx apps/api/src/tests/manual-e2e-scraping-test.ts
 */

import { PrismaClient } from '@lia360/database';

const prisma = new PrismaClient();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_WORKSPACE_ID = process.env.TEST_WORKSPACE_ID || '';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';

// Test configuration
const TEST_URLS = [
  'https://www.linkedin.com/in/williamhgates', // Bill Gates (public profile)
];

/**
 * Helper function to make authenticated API calls
 */
async function apiCall(endpoint: string, method: string = 'GET', body?: unknown) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return {
    status: response.status,
    data: await response.json(),
  };
}

/**
 * Wait for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Poll job status until it reaches a terminal state
 */
async function waitForJobCompletion(
  jobId: string,
  maxWaitTime: number = 60000,
  pollInterval: number = 2000
): Promise<{ success: boolean; job: any }> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const response = await apiCall(`/api/v1/scraping/jobs/${jobId}`);

    if (response.status === 200) {
      const job = response.data.data;
      console.log(`  Job status: ${job.status}, progress: ${job.progress}/${job.totalUrls || '?'}`);

      if (job.status === 'completed' || job.status === 'failed') {
        return { success: true, job };
      }
    } else {
      console.error(`  Error checking job status:`, response.data);
      return { success: false, job: null };
    }

    await sleep(pollInterval);
  }

  return { success: false, job: null };
}

/**
 * Test 1: Create scraping job
 */
async function testCreateJob() {
  console.log('\n=== Test 1: Create Scraping Job ===');

  const response = await apiCall('/api/v1/scraping/jobs', 'POST', {
    urls: TEST_URLS,
    platform: 'linkedin',
    metadata: {
      test: true,
      source: 'e2e-test',
    },
  });

  console.log(`Status: ${response.status}`);
  console.log('Response:', JSON.stringify(response.data, null, 2));

  if (response.status === 201) {
    console.log('✅ Job created successfully');
    return response.data.data.id;
  } else {
    console.error('❌ Failed to create job');
    return null;
  }
}

/**
 * Test 2: Check job status (pending)
 */
async function testJobStatusPending(jobId: string) {
  console.log('\n=== Test 2: Check Job Status (Should be pending or processing) ===');

  const response = await apiCall(`/api/v1/scraping/jobs/${jobId}`);

  console.log(`Status: ${response.status}`);
  console.log('Response:', JSON.stringify(response.data, null, 2));

  if (response.status === 200) {
    const job = response.data.data;
    console.log(`✅ Job retrieved: ${job.status}`);
    console.log(`  - Created at: ${job.createdAt}`);
    console.log(`  - Total URLs: ${job.totalUrls || 'pending'}`);
    console.log(`  - Progress: ${job.progress}/${job.totalUrls || '?'}`);
    return true;
  } else {
    console.error('❌ Failed to retrieve job');
    return false;
  }
}

/**
 * Test 3: Wait for job completion
 */
async function testWaitForCompletion(jobId: string) {
  console.log('\n=== Test 3: Wait for Job Completion ===');
  console.log('Waiting for job to complete...');

  const { success, job } = await waitForJobCompletion(jobId);

  if (success && job) {
    console.log(`✅ Job ${job.status}`);
    console.log(`  - Started at: ${job.startedAt}`);
    console.log(`  - Completed at: ${job.completedAt}`);
    console.log(`  - Total URLs: ${job.totalUrls}`);
    console.log(`  - Progress: ${job.progress}/${job.totalUrls}`);
    return job;
  } else {
    console.error('❌ Job did not complete in time');
    return null;
  }
}

/**
 * Test 4: Retrieve results
 */
async function testRetrieveResults(jobId: string, job: any) {
  console.log('\n=== Test 4: Retrieve Results ===');

  if (!job.results || job.results.length === 0) {
    console.log('⚠️  No results to retrieve');
    return false;
  }

  console.log(`Results count: ${job.results.length}`);
  job.results.forEach((result: any, index: number) => {
    console.log(`\nResult ${index + 1}:`);
    console.log(`  URL: ${result.url}`);
    console.log(`  Success: ${result.success}`);

    if (result.success) {
      console.log(`  Data:`);
      console.log(JSON.stringify(result.data, null, 4));
    } else {
      console.log(`  Error: ${result.error}`);
    }
  });

  if (job.errors && Object.keys(job.errors).length > 0) {
    console.log('\nErrors:');
    console.log(JSON.stringify(job.errors, null, 2));
  }

  return true;
}

/**
 * Test 5: Verify database persistence
 */
async function testDatabasePersistence(jobId: string) {
  console.log('\n=== Test 5: Verify Database Persistence ===');

  try {
    const job = await prisma.scrapingJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      console.error('❌ Job not found in database');
      return false;
    }

    console.log('✅ Job found in database');
    console.log(`  - ID: ${job.id}`);
    console.log(`  - Workspace ID: ${job.workspaceId}`);
    console.log(`  - Platform: ${job.platform}`);
    console.log(`  - Status: ${job.status}`);
    console.log(`  - Created at: ${job.createdAt}`);
    console.log(`  - Started at: ${job.startedAt}`);
    console.log(`  - Completed at: ${job.completedAt}`);
    console.log(`  - Total URLs: ${job.totalUrls}`);
    console.log(`  - Progress: ${job.progress}`);
    console.log(`  - Results count: ${job.results ? (job.results as any).length : 0}`);

    return true;
  } catch (error) {
    console.error('❌ Error querying database:', error);
    return false;
  }
}

/**
 * Test 6: List jobs (pagination)
 */
async function testListJobs() {
  console.log('\n=== Test 6: List Jobs (Pagination) ===');

  const response = await apiCall('/api/v1/scraping/jobs?page=1&limit=10&status=completed');

  console.log(`Status: ${response.status}`);
  console.log('Response:', JSON.stringify(response.data, null, 2));

  if (response.status === 200) {
    console.log('✅ Jobs retrieved successfully');
    console.log(`  - Total jobs: ${response.data.pagination.total}`);
    console.log(`  - Current page: ${response.data.pagination.page}`);
    console.log(`  - Jobs on page: ${response.data.data.length}`);
    return true;
  } else {
    console.error('❌ Failed to retrieve jobs');
    return false;
  }
}

/**
 * Test 7: Error handling - Invalid URL
 */
async function testInvalidURL() {
  console.log('\n=== Test 7: Error Handling - Invalid URL ===');

  const response = await apiCall('/api/v1/scraping/jobs', 'POST', {
    urls: ['not-a-valid-url', 'https://www.linkedin.com/in/test'],
    platform: 'linkedin',
  });

  console.log(`Status: ${response.status}`);
  console.log('Response:', JSON.stringify(response.data, null, 2));

  if (response.status === 400) {
    console.log('✅ Invalid URL correctly rejected');
    return true;
  } else {
    console.error('❌ Invalid URL should have been rejected');
    return false;
  }
}

/**
 * Test 8: Error handling - Invalid platform
 */
async function testInvalidPlatform() {
  console.log('\n=== Test 8: Error Handling - Invalid Platform ===');

  const response = await apiCall('/api/v1/scraping/jobs', 'POST', {
    urls: ['https://www.linkedin.com/in/test'],
    platform: 'invalid-platform',
  });

  console.log(`Status: ${response.status}`);
  console.log('Response:', JSON.stringify(response.data, null, 2));

  if (response.status === 400) {
    console.log('✅ Invalid platform correctly rejected');
    return true;
  } else {
    console.error('❌ Invalid platform should have been rejected');
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   Scraping End-to-End Integration Test                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`API URL: ${API_URL}`);
  console.log(`Workspace ID: ${TEST_WORKSPACE_ID || 'Not set'}`);
  console.log(`Auth Token: ${AUTH_TOKEN ? 'Set' : 'Not set'}`);

  if (!TEST_WORKSPACE_ID || !AUTH_TOKEN) {
    console.error('\n❌ Error: TEST_WORKSPACE_ID and TEST_AUTH_TOKEN must be set');
    console.log('  export TEST_WORKSPACE_ID="your-workspace-id"');
    console.log('  export TEST_AUTH_TOKEN="your-auth-token"');
    process.exit(1);
  }

  const results: { name: string; passed: boolean }[] = [];

  // Test 1: Create job
  const jobId = await testCreateJob();
  results.push({ name: 'Create Job', passed: !!jobId });

  if (!jobId) {
    console.error('\n❌ Cannot continue tests without job ID');
    process.exit(1);
  }

  // Test 2: Check pending status
  const statusPending = await testJobStatusPending(jobId);
  results.push({ name: 'Check Status Pending', passed: statusPending });

  // Test 3: Wait for completion
  const completedJob = await testWaitForCompletion(jobId);
  results.push({ name: 'Wait for Completion', passed: !!completedJob });

  // Test 4: Retrieve results
  const retrievedResults = completedJob ? await testRetrieveResults(jobId, completedJob) : false;
  results.push({ name: 'Retrieve Results', passed: retrievedResults });

  // Test 5: Database persistence
  const dbPersistence = await testDatabasePersistence(jobId);
  results.push({ name: 'Database Persistence', passed: dbPersistence });

  // Test 6: List jobs
  const listJobs = await testListJobs();
  results.push({ name: 'List Jobs', passed: listJobs });

  // Test 7: Invalid URL
  const invalidURL = await testInvalidURL();
  results.push({ name: 'Invalid URL Handling', passed: invalidURL });

  // Test 8: Invalid platform
  const invalidPlatform = await testInvalidPlatform();
  results.push({ name: 'Invalid Platform Handling', passed: invalidPlatform });

  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║   Test Summary                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.name}`);
  });

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  console.log(`\nTotal: ${passedCount}/${totalCount} tests passed`);

  await prisma.$disconnect();

  process.exit(passedCount === totalCount ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
