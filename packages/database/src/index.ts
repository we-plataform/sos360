import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

// Log for debugging
console.log('[Database] Initializing Prisma Client...');
console.log('[Database] DATABASE_URL set:', !!process.env.DATABASE_URL);

// Prisma Client (for ORM operations)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient;

try {
  prismaInstance = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
  
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaInstance;
  }
  
  console.log('[Database] Prisma Client initialized successfully');
} catch (error) {
  console.error('[Database] FATAL: Failed to initialize Prisma Client:', error);
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
