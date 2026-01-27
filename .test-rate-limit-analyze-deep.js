#!/usr/bin/env node

/**
 * Test Rate Limiting for /leads/analyze-deep endpoint
 *
 * This script tests that the rate limiting middleware correctly limits
 * requests to the /leads/analyze-deep endpoint to 10 requests per minute.
 *
 * The analyze-deep endpoint uses gpt-4o with vision capabilities, which is
 * more expensive than gpt-4o-mini used by the regular analyze endpoint.
 * Therefore, it has a stricter rate limit of 10/min vs 20/min.
 *
 * Usage: node .test-rate-limit-analyze-deep.js
 */

const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 3001;
const RATE_LIMIT = 10; // 10 requests per minute (vision model = expensive)
const TOTAL_REQUESTS = RATE_LIMIT + 1; // Send one more than the limit

// Test payload with minimal data for deep analysis
const testPayload = JSON.stringify({
  leadId: 'test-lead-id',
  profile: {
    username: 'test-user-deep',
    platform: 'instagram',
    bio: 'Test user bio for deep analysis'
  },
  posts: [
    {
      content: 'Test post content for deep analysis',
      likes: 100,
      comments: 10
    }
  ]
});

/**
 * Send a single POST request to /leads/analyze-deep
 */
function sendDeepAnalysisRequest() {
  return new Promise((resolve, reject) => {
    const postData = testPayload;

    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/v1/leads/analyze-deep',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Main test function
 */
async function testRateLimit() {
  console.log('='.repeat(70));
  console.log('Testing Rate Limiting for /leads/analyze-deep');
  console.log('='.repeat(70));
  console.log(`Rate Limit: ${RATE_LIMIT} requests per minute`);
  console.log(`Total Requests: ${TOTAL_REQUESTS}`);
  console.log(`Model: gpt-4o with vision (more expensive than gpt-4o-mini)`);
  console.log('');

  const results = [];
  let rateLimited = false;

  console.log('Sending requests...');
  for (let i = 1; i <= TOTAL_REQUESTS; i++) {
    try {
      const response = await sendDeepAnalysisRequest();
      results.push({
        request: i,
        status: response.statusCode,
        body: response.body,
      });

      // Check if we got rate limited
      if (response.statusCode === 429) {
        rateLimited = true;
        console.log(`Request ${i}: ✅ RATE LIMITED (429)`);
        break; // Stop after hitting rate limit
      } else if (response.statusCode === 401) {
        // Expected - endpoint requires authentication
        // Rate limiter should still work based on IP
        console.log(`Request ${i}: 401 Unauthorized (rate limiter tracks IP)`);
      } else {
        console.log(`Request ${i}: ${response.statusCode}`);
      }
    } catch (error) {
      console.error(`Request ${i}: Error - ${error.message}`);
      results.push({
        request: i,
        status: 'ERROR',
        error: error.message,
      });
    }

    // Small delay to avoid overwhelming the server
    // but fast enough to trigger rate limit
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('Test Results');
  console.log('='.repeat(70));
  console.log(`Total Requests Sent: ${results.length}`);
  console.log(`Rate Limit Triggered: ${rateLimited ? '✅ YES' : '❌ NO'}`);

  if (rateLimited) {
    const rateLimitResponse = results.find(r => r.status === 429);
    console.log('\nRate Limit Response:');
    console.log(`Status: ${rateLimitResponse.status}`);
    console.log(`Body: ${rateLimitResponse.body}`);
    console.log('\n✅ SUCCESS: Rate limiting is working correctly!');
    console.log('\nNote: Rate limit of 10/min is appropriate because:');
    console.log('- This endpoint uses gpt-4o with vision capabilities');
    console.log('- Vision model is significantly more expensive than gpt-4o-mini');
    console.log('- Each request can process multiple post images');
    console.log('- Prevents cost abuse while allowing legitimate deep analysis');
    process.exit(0);
  } else {
    console.log('\n❌ FAILURE: Rate limiting did not trigger');
    console.log('Expected: Request ' + (RATE_LIMIT + 1) + ' should return 429');
    console.log('Actual: All requests returned non-429 status codes');
    console.log('\nPossible issues:');
    console.log('- Rate limit middleware not applied to /leads/analyze-deep');
    console.log('- Rate limit window has expired (took too long between requests)');
    console.log('- Different IP addresses being used (should use same IP)');
    console.log('- Middleware might be after authorization (auth fails before rate limit)');
    process.exit(1);
  }
}

// Run the test
testRateLimit().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
