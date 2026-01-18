import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

// Log for debugging
console.log('[Database] Initializing Prisma Client...');
console.log('[Database] DATABASE_URL set:', !!process.env.DATABASE_URL);
console.log('[Database] DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
console.log('[Database] DATABASE_URL preview:', process.env.DATABASE_URL ? `${process.env.DATABASE_URL.substring(0, 30)}...` : 'NOT SET');

// Validate DATABASE_URL before initializing Prisma
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  const error = new Error('DATABASE_URL is required but not set or empty');
  console.error('[Database] FATAL:', error.message);
  throw error;
}

// Validate DATABASE_URL format
try {
  const url = new URL(process.env.DATABASE_URL);
  if (!url.hostname || url.hostname === '') {
    throw new Error('DATABASE_URL missing hostname');
  }
  console.log('[Database] DATABASE_URL hostname:', url.hostname);
  console.log('[Database] DATABASE_URL port:', url.port || 'default');
} catch (error) {
  console.error('[Database] FATAL: Invalid DATABASE_URL format:', error);
  throw new Error(`Invalid DATABASE_URL format: ${error instanceof Error ? error.message : 'unknown error'}`);
}

// Prisma Client (for ORM operations)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient;

try {
  // Test connection before creating client
  const testUrl = process.env.DATABASE_URL;
  if (!testUrl || testUrl.trim() === '') {
    throw new Error('DATABASE_URL is required but not set');
  }

  prismaInstance = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: testUrl,
      },
    },
  });
  
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaInstance;
  }
  
  console.log('[Database] Prisma Client initialized successfully');
  
  // Test connection immediately (optional, but helps catch issues early)
  if (process.env.NODE_ENV === 'production') {
    prismaInstance.$connect()
      .then(() => {
        console.log('[Database] Successfully connected to database');
      })
      .catch((err) => {
        console.error('[Database] WARNING: Failed to connect to database:', err.message);
        // Don't throw here - let it fail on first query
      });
  }
} catch (error) {
  console.error('[Database] FATAL: Failed to initialize Prisma Client');
  console.error('[Database] Error details:', error);
  if (error instanceof Error) {
    console.error('[Database] Error message:', error.message);
    console.error('[Database] Error stack:', error.stack);
  }
  throw error;
}

export const prisma = prismaInstance;

// Supabase Client (optional - only if configured)
// Create Supabase client only if URL and key are provided
const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log('[Database] Supabase Client initialized');
  } catch (error) {
    console.warn('[Database] Supabase not available:', error);
    supabase = null;
  }
} else {
  console.log('[Database] Supabase not configured (optional)');
}

// Export supabase (may be null if not configured)
export { supabase };

export * from '@prisma/client';
export default prisma;
