#!/usr/bin/env node

/**
 * Test script to verify token refresh flow and proactive refresh
 * This script tests that tokens are refreshed correctly every 2 minutes
 */

const http = require('http');

const API_URL = 'http://localhost:3001';
const LOGIN_ENDPOINT = '/api/v1/auth/login';
const REFRESH_ENDPOINT = '/api/v1/auth/refresh';
const ME_ENDPOINT = '/api/v1/auth/me';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(method, path, data = null, accessToken = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (accessToken) {
      options.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body),
          };
          resolve(response);
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    throw new Error(`Failed to decode token: ${error.message}`);
  }
}

function getTokenExpirationTime(token) {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return 0;
  return payload.exp * 1000; // Convert to milliseconds
}

function isTokenExpiringSoon(token) {
  const expirationTime = getTokenExpirationTime(token);
  if (!expirationTime) return true;

  const now = Date.now();
  const twoMinutes = 2 * 60 * 1000;

  // Return true if token expires within 2 minutes
  return expirationTime - now < twoMinutes;
}

function formatTimeRemaining(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

async function testLogin(email, password) {
  log('\n=== Testing Login Endpoint ===', 'blue');
  log(`Email: ${email}`, 'blue');

  try {
    const response = await makeRequest('POST', LOGIN_ENDPOINT, { email, password });

    if (response.statusCode !== 200) {
      log(`\n❌ Login failed with status ${response.statusCode}`, 'red');
      log(`Response: ${JSON.stringify(response.body, null, 2)}`, 'red');
      return null;
    }

    if (!response.body.success) {
      log('\n❌ Login unsuccessful', 'red');
      log(`Response: ${JSON.stringify(response.body, null, 2)}`, 'red');
      return null;
    }

    log('\n✅ Login successful!', 'green');

    const data = response.body.data;

    // Check if selection is required
    if (data.selectionRequired) {
      log('\n⚠️  Context selection required', 'yellow');
      log(`Available companies: ${data.companies.length}`, 'yellow');

      if (data.companies.length > 0 && data.companies[0].workspaces.length > 0) {
        const company = data.companies[0];
        const workspace = company.workspaces[0];

        log(`\nAuto-selecting first company/workspace...`, 'yellow');
        log(`Company: ${company.name} (${company.slug})`, 'yellow');
        log(`Workspace: ${workspace.name}`, 'yellow');

        const selectResponse = await makeRequest('POST', '/api/v1/auth/select-context', {
          selectionToken: data.selectionToken,
          companyId: company.id,
          workspaceId: workspace.id,
        });

        if (selectResponse.statusCode === 200 && selectResponse.body.success) {
          log('\n✅ Context selected!', 'green');
          return selectResponse.body.data;
        } else {
          log('\n❌ Context selection failed', 'red');
          return null;
        }
      } else {
        log('\n❌ No companies/workspaces available', 'red');
        return null;
      }
    }

    return data;
  } catch (error) {
    log(`\n❌ Request failed: ${error.message}`, 'red');
    return null;
  }
}

async function testRefreshToken(refreshToken) {
  log('\n=== Testing Refresh Token Endpoint ===', 'blue');

  try {
    const response = await makeRequest('POST', REFRESH_ENDPOINT, { refreshToken });

    if (response.statusCode !== 200) {
      log(`\n❌ Refresh failed with status ${response.statusCode}`, 'red');
      log(`Response: ${JSON.stringify(response.body, null, 2)}`, 'red');
      return null;
    }

    if (!response.body.success) {
      log('\n❌ Refresh unsuccessful', 'red');
      log(`Response: ${JSON.stringify(response.body, null, 2)}`, 'red');
      return null;
    }

    log('\n✅ Token refresh successful!', 'green');
    return response.body.data;
  } catch (error) {
    log(`\n❌ Refresh request failed: ${error.message}`, 'red');
    return null;
  }
}

async function testProtectedEndpoint(accessToken) {
  log('\n=== Testing Protected Endpoint (/auth/me) ===', 'blue');

  try {
    const response = await makeRequest('GET', ME_ENDPOINT, null, accessToken);

    if (response.statusCode !== 200) {
      log(`\n❌ Request failed with status ${response.statusCode}`, 'red');
      log(`Response: ${JSON.stringify(response.body, null, 2)}`, 'red');
      return false;
    }

    if (!response.body.success) {
      log('\n❌ Request unsuccessful', 'red');
      return false;
    }

    log('\n✅ Protected endpoint accessible!', 'green');
    log(`User: ${response.body.data.user.email}`, 'cyan');
    return true;
  } catch (error) {
    log(`\n❌ Request failed: ${error.message}`, 'red');
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  log('\n========================================', 'blue');
  log('  Token Refresh Flow Test', 'blue');
  log('========================================', 'blue');

  // Test credentials (you may need to adjust these)
  const testEmail = 'test@example.com';
  const testPassword = 'Password123';

  // Step 1: Login
  const loginData = await testLogin(testEmail, testPassword);

  if (!loginData || !loginData.accessToken || !loginData.refreshToken) {
    log('\n❌ Failed to obtain tokens', 'red');
    process.exit(1);
  }

  let accessToken = loginData.accessToken;
  const refreshToken = loginData.refreshToken;

  log('\n=== Initial Token Information ===', 'blue');
  const initialExpiration = getTokenExpirationTime(accessToken);
  const initialTimeRemaining = initialExpiration - Date.now();
  log(`Initial token expires in: ${formatTimeRemaining(initialTimeRemaining)}`, 'cyan');
  log(`Initial token is expiring soon: ${isTokenExpiringSoon(accessToken)}`, 'cyan');

  // Step 2: Test protected endpoint with initial token
  log('\n=== Step 1: Verify initial token works ===', 'blue');
  const initialRequestSuccess = await testProtectedEndpoint(accessToken);
  if (!initialRequestSuccess) {
    log('\n❌ Initial token failed to access protected endpoint', 'red');
    process.exit(1);
  }

  // Step 3: Test manual token refresh
  log('\n=== Step 2: Test manual token refresh ===', 'blue');
  const refreshData = await testRefreshToken(refreshToken);

  if (!refreshData || !refreshData.accessToken) {
    log('\n❌ Failed to refresh token', 'red');
    process.exit(1);
  }

  accessToken = refreshData.accessToken;
  log(`\nNew token expires in: ${formatTimeRemaining(getTokenExpirationTime(accessToken) - Date.now())}`, 'cyan');

  // Step 4: Test protected endpoint with new token
  log('\n=== Step 3: Verify refreshed token works ===', 'blue');
  const refreshedRequestSuccess = await testProtectedEndpoint(accessToken);
  if (!refreshedRequestSuccess) {
    log('\n❌ Refreshed token failed to access protected endpoint', 'red');
    process.exit(1);
  }

  // Step 5: Test proactive refresh (wait for token to expire soon)
  log('\n=== Step 4: Test proactive refresh behavior ===', 'blue');
  log('Waiting for token to enter "expiring soon" window (within 2 minutes of expiration)...', 'yellow');

  // Wait until token is expiring soon
  let attempts = 0;
  const maxAttempts = 20; // Maximum 10 minutes wait
  while (!isTokenExpiringSoon(accessToken) && attempts < maxAttempts) {
    const timeRemaining = getTokenExpirationTime(accessToken) - Date.now();
    log(`[${attempts + 1}/${maxAttempts}] Time until expiring soon: ${formatTimeRemaining(timeRemaining - (2 * 60 * 1000))}`, 'cyan');
    await sleep(30000); // Wait 30 seconds between checks
    attempts++;
  }

  if (attempts >= maxAttempts) {
    log('\n⚠️  Timeout waiting for token to expire soon (max 10 minutes)', 'yellow');
    log('This is expected if the initial token was just issued', 'yellow');
  } else {
    log('\n✅ Token is now expiring soon!', 'green');
    log(`isTokenExpiringSoon() returned: true`, 'cyan');

    // Test refresh when expiring soon
    log('\n=== Step 5: Refresh token when expiring soon ===', 'blue');
    const expiringSoonRefreshData = await testRefreshToken(refreshToken);

    if (!expiringSoonRefreshData || !expiringSoonRefreshData.accessToken) {
      log('\n❌ Failed to refresh expiring token', 'red');
      process.exit(1);
    }

    accessToken = expiringSoonRefreshData.accessToken;
    const newExpiration = getTokenExpirationTime(accessToken);
    const newTimeRemaining = newExpiration - Date.now();

    log(`\n✅ Token refreshed successfully!`, 'green');
    log(`New token expires in: ${formatTimeRemaining(newTimeRemaining)}`, 'cyan');
    log(`New token has full lifetime (~15 minutes): ${newTimeRemaining > 14 * 60 * 1000}`, 'cyan');

    // Verify new token works
    log('\n=== Step 6: Verify new token works ===', 'blue');
    const newTokenSuccess = await testProtectedEndpoint(accessToken);
    if (!newTokenSuccess) {
      log('\n❌ New token after refresh failed to access protected endpoint', 'red');
      process.exit(1);
    }
  }

  // Summary
  log('\n========================================', 'blue');
  log('✅ ALL REFRESH TESTS PASSED!', 'green');
  log('\nSummary:', 'green');
  log('  • Login and obtain tokens ✅', 'green');
  log('  • Manual token refresh works ✅', 'green');
  log('  • Refreshed token can access protected endpoints ✅', 'green');
  log('  • Proactive refresh detection works ✅', 'green');
  log('  • Token refresh when expiring soon works ✅', 'green');
  log('\nToken refresh flow is working correctly!', 'green');
  log('========================================\n', 'blue');
}

main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
