#!/usr/bin/env node

/**
 * Manual CORS Verification Script for Production Mode
 *
 * This script verifies that the CORS configuration correctly validates
 * Chrome extension origins in production mode with CHROME_EXTENSION_ID set.
 *
 * Usage:
 *   CHROME_EXTENSION_ID=testext123 NODE_ENV=production node verify-cors-production.js
 */

import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

// Load environment variables
config();

// Mock logger
const logger = {
  warn: (...args) => {
    // Suppress output in production mode for cleaner test results
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[WARN]', ...args);
    }
  },
};

// Simulate the production CORS logic
const createCORSOptions = () => {
  return {
    origin: (origin, callback) => {
      // Allow requests with no origin
      if (!origin) {
        return callback(null, true);
      }

      // Validate Chrome extensions against CHROME_EXTENSION_ID
      if (origin.startsWith('chrome-extension://')) {
        const extensionId = origin.replace('chrome-extension://', '');

        // If CHROME_EXTENSION_ID is configured, only allow that specific extension
        if (process.env.CHROME_EXTENSION_ID) {
          if (extensionId === process.env.CHROME_EXTENSION_ID) {
            console.log(`✓ ALLOWED: ${origin} (matches CHROME_EXTENSION_ID)`);
            return callback(null, true);
          }
          // Extension ID mismatch - reject
          console.log(`✗ REJECTED: ${origin} (does not match CHROME_EXTENSION_ID=${process.env.CHROME_EXTENSION_ID})`);
          if (process.env.NODE_ENV === 'production') {
            logger.warn({
              origin,
              extensionId,
              expectedExtensionId: process.env.CHROME_EXTENSION_ID
            }, 'CORS: Chrome extension rejected - ID mismatch');
          }
          return callback(new Error('Not allowed by CORS'));
        }

        // In production, reject if CHROME_EXTENSION_ID is not configured
        console.log(`✗ REJECTED: ${origin} (CHROME_EXTENSION_ID not configured)`);
        logger.warn({
          origin,
          extensionId,
          message: 'CHROME_EXTENSION_ID not configured - rejecting extension in production'
        }, 'CORS: Chrome extension rejected - missing CHROME_EXTENSION_ID');
        return callback(new Error('Not allowed by CORS'));
      }

      // Check if origin matches any configured origin
      const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [];
      const isAllowed = corsOrigins.some((allowedOrigin) => {
        if (allowedOrigin === origin) {
          return true;
        }
        if (allowedOrigin.includes('*')) {
          const pattern = allowedOrigin.replace(/\*/g, '.*');
          const regex = new RegExp(`^${pattern}$`);
          return regex.test(origin);
        }
        return false;
      });

      if (isAllowed || corsOrigins.includes('*')) {
        console.log(`✓ ALLOWED: ${origin} (in CORS_ORIGINS)`);
        return callback(null, true);
      }

      console.log(`✗ REJECTED: ${origin} (not in CORS_ORIGINS)`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
  };
};

// Test scenarios
const runTests = () => {
  console.log('\n=== CORS Production Mode Verification ===\n');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CHROME_EXTENSION_ID: ${process.env.CHROME_EXTENSION_ID || 'NOT SET'}`);
  console.log(`CORS_ORIGINS: ${process.env.CORS_ORIGINS || 'NOT SET'}\n`);

  const corsOptions = createCORSOptions();
  const testCases = [
    {
      name: 'Valid extension ID match',
      origin: process.env.CHROME_EXTENSION_ID
        ? `chrome-extension://${process.env.CHROME_EXTENSION_ID}`
        : null,
      expected: 'ALLOWED',
      skip: !process.env.CHROME_EXTENSION_ID
    },
    {
      name: 'Different extension ID',
      origin: 'chrome-extension://differentextensionid123',
      expected: 'REJECTED'
    },
    {
      name: 'Random extension ID',
      origin: 'chrome-extension://abcdefghijklmnopqrstuvwxyz',
      expected: 'REJECTED'
    },
    {
      name: 'Empty extension ID',
      origin: 'chrome-extension://',
      expected: 'REJECTED'
    },
    {
      name: 'Partial extension ID match',
      origin: process.env.CHROME_EXTENSION_ID
        ? `chrome-extension://${process.env.CHROME_EXTENSION_ID.substring(0, Math.max(1, process.env.CHROME_EXTENSION_ID.length - 3))}`
        : null,
      expected: 'REJECTED',
      skip: !process.env.CHROME_EXTENSION_ID || process.env.CHROME_EXTENSION_ID.length < 4
    },
    {
      name: 'Uppercase extension ID (case sensitivity)',
      origin: process.env.CHROME_EXTENSION_ID
        ? `chrome-extension://${process.env.CHROME_EXTENSION_ID.toUpperCase()}`
        : null,
      expected: 'REJECTED',
      skip: !process.env.CHROME_EXTENSION_ID
    },
    {
      name: 'Web origin in CORS_ORIGINS',
      origin: 'https://lia360.app',
      expected: 'ALLOWED',
      skip: !process.env.CORS_ORIGINS?.includes('lia360.app')
    },
    {
      name: 'No origin (mobile apps, curl)',
      origin: undefined,
      expected: 'ALLOWED'
    }
  ];

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  console.log('Running test cases:\n');

  testCases.forEach((testCase) => {
    if (testCase.skip) {
      console.log(`⊘ SKIP: ${testCase.name}`);
      skipped++;
      return;
    }

    let result = 'UNKNOWN';
    let error = null;

    try {
      corsOptions.origin(testCase.origin, (err, allow) => {
        if (err) {
          result = 'REJECTED';
          error = err.message;
        } else if (allow) {
          result = 'ALLOWED';
        } else {
          result = 'REJECTED';
        }

        const success = result === testCase.expected;
        if (success) {
          console.log(`✓ PASS: ${testCase.name}`);
          passed++;
        } else {
          console.log(`✗ FAIL: ${testCase.name}`);
          console.log(`  Expected: ${testCase.expected}, Got: ${result}`);
          if (error) console.log(`  Error: ${error}`);
          failed++;
        }
      });
    } catch (err) {
      result = 'REJECTED';
      const success = result === testCase.expected;
      if (success) {
        console.log(`✓ PASS: ${testCase.name}`);
        passed++;
      } else {
        console.log(`✗ FAIL: ${testCase.name}`);
        console.log(`  Expected: ${testCase.expected}, Got: ${result}`);
        console.log(`  Error: ${err.message}`);
        failed++;
      }
    }
  });

  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);

  if (failed === 0 && passed > 0) {
    console.log('\n✓ All tests passed! CORS validation is working correctly.');
    process.exit(0);
  } else if (failed > 0) {
    console.log('\n✗ Some tests failed. Please review the CORS configuration.');
    process.exit(1);
  } else {
    console.log('\n⚠ No tests were run. Please check your environment configuration.');
    process.exit(2);
  }
};

// Run the tests
runTests();
