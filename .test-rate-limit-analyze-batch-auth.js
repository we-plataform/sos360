#!/usr/bin/env node

/**
 * Test Rate Limiting for /leads/analyze-batch with Authentication
 *
 * This script tests rate limiting with real authentication by registering
 * a user, logging in, and then sending batch analyze requests.
 *
 * Usage: node .test-rate-limit-analyze-batch-auth.js
 */

const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 3001;
const RATE_LIMIT = 5; // 5 requests per minute
const TOTAL_REQUESTS = RATE_LIMIT + 1;

// Test user credentials (randomized to avoid conflicts)
const testUser = {
  email: `test-batch-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  firstName: 'Test',
  lastName: 'User',
};

let authToken = null;

/**
 * Send an HTTP request
 */
function sendRequest(method, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;

    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: method,
      headers: reqHeaders,
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const body = responseData ? JSON.parse(responseData) : null;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseData,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

/**
 * Register a new user
 */
async function registerUser() {
  console.log('Registering test user...');
  try {
    const response = await sendRequest('POST', '/api/v1/auth/register', {
      ...testUser,
      companyName: 'Test Company',
    });

    if (response.statusCode === 201 || response.statusCode === 200) {
      console.log('✅ User registered successfully');
      return true;
    } else {
      console.log(`⚠️  Registration failed with status ${response.statusCode}`);
      console.log('Response:', response.body);
      return false;
    }
  } catch (error) {
    console.error('❌ Registration error:', error.message);
    return false;
  }
}

/**
 * Login and get auth token
 */
async function loginUser() {
  console.log('Logging in...');
  try {
    const response = await sendRequest('POST', '/api/v1/auth/login', {
      email: testUser.email,
      password: testUser.password,
    });

    if (response.statusCode === 200 && response.body?.data?.tokens?.accessToken) {
      authToken = response.body.data.tokens.accessToken;
      console.log('✅ Login successful');
      console.log(`Token: ${authToken.substring(0, 20)}...`);
      return true;
    } else {
      console.log(`❌ Login failed with status ${response.statusCode}`);
      console.log('Response:', response.body);
      return false;
    }
  } catch (error) {
    console.error('❌ Login error:', error.message);
    return false;
  }
}

/**
 * Send a batch analyze request
 */
async function sendBatchAnalyzeRequest(requestNum) {
  const payload = {
    profiles: [
      { username: `test-user-${requestNum}-1` },
      { username: `test-user-${requestNum}-2` },
    ],
    criteria: 'test criteria for batch rate limiting',
  };

  return await sendRequest(
    'POST',
    '/api/v1/leads/analyze-batch',
    payload,
    { Authorization: `Bearer ${authToken}` }
  );
}

/**
 * Main test function
 */
async function testRateLimit() {
  console.log('='.repeat(60));
  console.log('Testing Rate Limiting for /leads/analyze-batch');
  console.log('With Authentication');
  console.log('='.repeat(60));
  console.log(`Rate Limit: ${RATE_LIMIT} requests per minute`);
  console.log(`Total Requests: ${TOTAL_REQUESTS}`);
  console.log('');

  // Step 1: Register and login
  const registered = await registerUser();
  if (!registered) {
    console.log('\n⚠️  Could not register user. Trying with existing user...');
    console.log('Please ensure a user exists or update the test with valid credentials.');
    console.log('Continuing without authentication (will test IP-based rate limiting)...');
    console.log('');
  } else {
    const loggedIn = await loginUser();
    if (!loggedIn) {
      console.log('\n❌ Could not authenticate. Exiting.');
      process.exit(1);
    }
    console.log('');
  }

  // Step 2: Send requests
  console.log('Sending batch analyze requests...');
  const results = [];
  let rateLimited = false;

  for (let i = 1; i <= TOTAL_REQUESTS; i++) {
    try {
      const response = await sendBatchAnalyzeRequest(i);
      results.push({
        request: i,
        status: response.statusCode,
        body: response.body,
      });

      // Check if we got rate limited
      if (response.statusCode === 429) {
        rateLimited = true;
        console.log(`Request ${i}: ✅ RATE LIMITED (429)`);
        console.log(`  Message: ${response.body?.error?.detail || response.body?.error || 'No message'}`);
        break; // Stop after hitting rate limit
      } else if (response.statusCode === 401) {
        console.log(`Request ${i}: 401 Unauthorized`);
      } else if (response.statusCode === 200 || response.statusCode === 201) {
        console.log(`Request ${i}: ${response.statusCode} (Success)`);
      } else {
        console.log(`Request ${i}: ${response.statusCode}`);
        if (response.body?.error) {
          console.log(`  Error: ${response.body.error}`);
        }
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
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Step 3: Report results
  console.log('');
  console.log('='.repeat(60));
  console.log('Test Results');
  console.log('='.repeat(60));
  console.log(`Total Requests Sent: ${results.length}`);
  console.log(`Rate Limit Triggered: ${rateLimited ? '✅ YES' : '❌ NO'}`);

  if (rateLimited) {
    const rateLimitResponse = results.find(r => r.status === 429);
    console.log('\nRate Limit Response:');
    console.log(`Status: ${rateLimitResponse.status}`);
    console.log(`Body: ${JSON.stringify(rateLimitResponse.body, null, 2)}`);
    console.log('\n✅ SUCCESS: Rate limiting is working correctly!');
    console.log('\nNote: Rate limiting is based on user ID when authenticated.');
    process.exit(0);
  } else {
    console.log('\n❌ FAILURE: Rate limiting did not trigger');
    console.log('Expected: Request ' + (RATE_LIMIT + 1) + ' should return 429');
    console.log('Actual: All requests returned non-429 status codes');
    console.log('\nPossible issues:');
    console.log('- Rate limit middleware not applied to /leads/analyze-batch');
    console.log('- Rate limit window has expired (took too long between requests)');
    console.log('- Authentication not working correctly');
    process.exit(1);
  }
}

// Run the test
testRateLimit().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
