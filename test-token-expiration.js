#!/usr/bin/env node

/**
 * Test script to verify JWT access token expiration time
 * This script tests login and verifies the access token expires in 15 minutes
 */

const http = require('http');

const API_URL = 'http://localhost:3001';
const LOGIN_ENDPOINT = '/api/v1/auth/login';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

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

function verifyTokenExpiration(decodedToken) {
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const iat = decodedToken.iat;
  const exp = decodedToken.exp;
  const expiresIn = exp - iat;
  const timeUntilExpiry = exp - now;

  log('\n=== Token Expiration Details ===', 'blue');
  log(`Issued At (iat): ${new Date(iat * 1000).toISOString()}`, 'blue');
  log(`Expiration (exp): ${new Date(exp * 1000).toISOString()}`, 'blue');
  log(`Expires In (from iat to exp): ${expiresIn} seconds (${expiresIn / 60} minutes)`, 'blue');
  log(`Time Until Expiry: ${timeUntilExpiry} seconds (${Math.round(timeUntilExpiry / 60)} minutes)`, 'blue');

  return { expiresIn, timeUntilExpiry, iat, exp };
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

async function main() {
  log('\n========================================', 'blue');
  log('  JWT Token Expiration Test', 'blue');
  log('========================================', 'blue');

  // Test credentials (you may need to adjust these)
  const testEmail = 'test@example.com';
  const testPassword = 'password123';

  const loginData = await testLogin(testEmail, testPassword);

  if (!loginData || !loginData.accessToken) {
    log('\n❌ Failed to obtain access token', 'red');
    log('\nHint: Make sure you have a test user in the database', 'yellow');
    log('You can create one via POST /api/v1/auth/register', 'yellow');
    process.exit(1);
  }

  log('\n=== Response Data ===', 'blue');
  log(`ExpiresIn field: ${loginData.expiresIn} seconds`, 'blue');
  log(`Expected: 900 seconds (15 minutes)`, 'blue');

  // Decode and verify the token
  let decodedToken;
  try {
    decodedToken = decodeJWT(loginData.accessToken);
    log('\n✅ Token decoded successfully', 'green');
  } catch (error) {
    log(`\n❌ Failed to decode token: ${error.message}`, 'red');
    process.exit(1);
  }

  // Verify expiration
  const { expiresIn, timeUntilExpiry, iat, exp } = verifyTokenExpiration(decodedToken);

  // Verify results
  log('\n=== Verification Results ===', 'blue');

  const expectedExpiresIn = 900; // 15 minutes in seconds
  const tolerance = 5; // 5 seconds tolerance for token generation time

  let allPassed = true;

  // Check expiresIn field
  if (loginData.expiresIn === expectedExpiresIn) {
    log(`✅ expiresIn field: ${loginData.expiresIn}s (correct!)`, 'green');
  } else {
    log(`❌ expiresIn field: ${loginData.expiresIn}s (expected ${expectedExpiresIn}s)`, 'red');
    allPassed = false;
  }

  // Check token expiration (exp - iat)
  if (Math.abs(expiresIn - expectedExpiresIn) <= tolerance) {
    log(`✅ Token expiration: ${expiresIn}s (correct!)`, 'green');
  } else {
    log(`❌ Token expiration: ${expiresIn}s (expected ${expectedExpiresIn}s)`, 'red');
    allPassed = false;
  }

  // Check that token is still valid
  const now = Math.floor(Date.now() / 1000);
  if (exp > now) {
    log(`✅ Token is still valid (${timeUntilExpiry}s remaining)`, 'green');
  } else {
    log(`❌ Token is expired`, 'red');
    allPassed = false;
  }

  // Check that expiration is approximately 15 minutes from issuance
  const actualExpiresInMinutes = expiresIn / 60;
  if (actualExpiresInMinutes === 15) {
    log(`✅ Token lifetime: ${actualExpiresInMinutes} minutes (correct!)`, 'green');
  } else {
    log(`❌ Token lifetime: ${actualExpiresInMinutes} minutes (expected 15 minutes)`, 'red');
    allPassed = false;
  }

  log('\n========================================', 'blue');
  if (allPassed) {
    log('✅ ALL CHECKS PASSED!', 'green');
    log('\nThe access token correctly expires in 15 minutes.', 'green');
    log('\nSummary:', 'green');
    log(`  • expiresIn field: ${loginData.expiresIn}s (15 minutes)`, 'green');
    log(`  • Token lifetime: ${expiresIn}s (${expiresIn / 60} minutes)`, 'green');
    log(`  • Token expires at: ${new Date(exp * 1000).toISOString()}`, 'green');
  } else {
    log('❌ SOME CHECKS FAILED', 'red');
    log('\nPlease review the results above.', 'red');
    process.exit(1);
  }
  log('========================================\n', 'blue');
}

main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
