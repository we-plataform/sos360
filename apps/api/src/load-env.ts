import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

// Load .env from project root BEFORE anything else
// When running via npm workspace, process.cwd() is apps/api, so we need to go up 2 levels

// Get __dirname equivalent that works in both ESM and CommonJS
let __dirname: string;
const importMetaUrl = typeof import.meta !== 'undefined' && import.meta.url;
if (importMetaUrl) {
  // ESM way
  __dirname = dirname(fileURLToPath(importMetaUrl));
} else {
  // Fallback: use process.cwd() if we can't determine __dirname
  __dirname = process.cwd();
}

// Determine project root: if cwd contains 'apps/api', go up 2 levels, otherwise use cwd
let projectRoot = process.cwd();
if (process.cwd().includes('apps/api') || process.cwd().endsWith('api')) {
  projectRoot = resolve(process.cwd(), '../..');
} else if (__dirname.includes('apps/api')) {
  projectRoot = resolve(__dirname, '../../../');
} else {
  projectRoot = process.cwd();
}

const envPath = resolve(projectRoot, '.env');

// Only try to load .env file if it exists (for local development)
// In production (Railway, etc.), environment variables are injected directly
if (existsSync(envPath)) {
  const result = config({ path: envPath });
  
  if (result.error) {
    // Only log warning in development, don't fail in production
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Warning: Could not load .env file!');
      console.warn('  Path tried:', envPath);
      console.warn('  Error:', result.error.message);
      console.warn('  Continuing with environment variables from process.env...');
    }
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.log(`✓ Loaded .env from: ${envPath}`);
    }
  }
} else {
  // File doesn't exist - this is normal in production
  if (process.env.NODE_ENV === 'development') {
    console.log('ℹ️  No .env file found, using environment variables from process.env');
  }
}
