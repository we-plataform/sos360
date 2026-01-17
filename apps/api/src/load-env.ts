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

// Debug info
if (process.env.NODE_ENV === 'development') {
  console.log('🔍 Debug: process.cwd() =', process.cwd());
  console.log('🔍 Debug: projectRoot =', projectRoot);
  console.log('🔍 Debug: envPath =', envPath);
  console.log('🔍 Debug: .env exists =', existsSync(envPath));
}

const result = config({ path: envPath });

if (result.error) {
  console.error('✗ ERROR: Could not load .env file!');
  console.error('  Path tried:', envPath);
  console.error('  Error:', result.error.message);
  console.error('\n💡 Make sure .env exists in the project root');
  process.exit(1);
} else {
  console.log(`✓ Loaded .env from: ${envPath}`);
}
