import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

// ============================================
// CONFIGURAÇÃO E VALIDAÇÃO DE DATABASE_URL
// ============================================

console.log('[Database] ========================================');
console.log('[Database] Initializing Database Connection...');
console.log('[Database] ========================================');

// Validate DATABASE_URL exists
const rawDatabaseUrl = process.env.DATABASE_URL;
const rawDirectUrl = process.env.DIRECT_URL;

console.log('[Database] Environment check:');
console.log('[Database]   - DATABASE_URL set:', !!rawDatabaseUrl);
console.log('[Database]   - DATABASE_URL length:', rawDatabaseUrl?.length || 0);
console.log('[Database]   - DIRECT_URL set:', !!rawDirectUrl);
console.log('[Database]   - NODE_ENV:', process.env.NODE_ENV || 'not set');

// Detailed validation function
function validateDatabaseUrl(url: string | undefined, name: string): { valid: boolean; url?: URL; error?: string } {
  if (!url || url.trim() === '') {
    return { valid: false, error: `${name} is required but not set or empty` };
  }

  const trimmedUrl = url.trim();

  // Check if URL starts with valid protocol
  if (!trimmedUrl.startsWith('postgresql://') && !trimmedUrl.startsWith('postgres://')) {
    return { valid: false, error: `${name} must start with postgresql:// or postgres://` };
  }

  try {
    const parsedUrl = new URL(trimmedUrl);

    // Validate hostname
    if (!parsedUrl.hostname || parsedUrl.hostname === '' || parsedUrl.hostname === 'undefined') {
      return { valid: false, error: `${name} is missing hostname. Got: "${parsedUrl.hostname}"` };
    }

    // Validate it's not a placeholder
    if (parsedUrl.hostname.includes('[') || parsedUrl.hostname.includes(']') ||
      parsedUrl.hostname === 'host' || parsedUrl.hostname === 'localhost' && process.env.NODE_ENV === 'production') {
      return { valid: false, error: `${name} appears to be a placeholder or invalid for production` };
    }

    // Check for common issues
    if (parsedUrl.password && parsedUrl.password.includes('@') && !parsedUrl.password.includes('%40')) {
      console.warn(`[Database] WARNING: ${name} password may contain unencoded @ character`);
    }

    return { valid: true, url: parsedUrl };
  } catch (error) {
    return {
      valid: false,
      error: `${name} is not a valid URL: ${error instanceof Error ? error.message : 'unknown error'}`
    };
  }
}

// Validate DATABASE_URL
const databaseUrlValidation = validateDatabaseUrl(rawDatabaseUrl, 'DATABASE_URL');

if (!databaseUrlValidation.valid) {
  console.error('[Database] ========================================');
  console.error('[Database] FATAL: DATABASE_URL VALIDATION FAILED');
  console.error('[Database] ========================================');
  console.error(`[Database] Error: ${databaseUrlValidation.error}`);
  console.error('[Database]');
  console.error('[Database] Expected format:');
  console.error('[Database]   postgresql://user:password@host:port/database');
  console.error('[Database]');
  console.error('[Database] For Supabase with pgbouncer:');
  console.error('[Database]   postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true');
  console.error('[Database]');
  console.error('[Database] Current value preview:', rawDatabaseUrl ? rawDatabaseUrl.substring(0, 50) + '...' : 'NOT SET');
  console.error('[Database] ========================================');
  throw new Error(`DATABASE_URL validation failed: ${databaseUrlValidation.error}`);
}

const parsedDbUrl = databaseUrlValidation.url!;
console.log('[Database] DATABASE_URL validated:');
console.log('[Database]   - Protocol:', parsedDbUrl.protocol);
console.log('[Database]   - Hostname:', parsedDbUrl.hostname);
console.log('[Database]   - Port:', parsedDbUrl.port || '5432 (default)');
console.log('[Database]   - Database:', parsedDbUrl.pathname.replace('/', '') || 'default');
console.log('[Database]   - Has pgbouncer:', parsedDbUrl.searchParams.get('pgbouncer') === 'true');

// Validate DIRECT_URL if provided
if (rawDirectUrl) {
  const directUrlValidation = validateDatabaseUrl(rawDirectUrl, 'DIRECT_URL');
  if (directUrlValidation.valid) {
    console.log('[Database] DIRECT_URL validated:');
    console.log('[Database]   - Hostname:', directUrlValidation.url!.hostname);
    console.log('[Database]   - Port:', directUrlValidation.url!.port || '5432 (default)');
  } else {
    console.warn('[Database] WARNING: DIRECT_URL validation failed:', directUrlValidation.error);
  }
}

// ============================================
// PRISMA CLIENT INITIALIZATION
// ============================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient;

try {
  console.log('[Database] Creating Prisma Client...');

  // Determine log level based on environment
  const logLevel = process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn'] as const
    : ['error'] as const;

  // Auto-fix connection string for Supabase Transaction Pooler
  let connectionUrl = rawDatabaseUrl!.trim();
  if (connectionUrl.includes(':6543') && !connectionUrl.includes('pgbouncer=true')) {
    console.log('[Database] Automatically appending ?pgbouncer=true to connection string for Transaction Pooler');
    connectionUrl += connectionUrl.includes('?') ? '&pgbouncer=true' : '?pgbouncer=true';
  }

  prismaInstance = globalForPrisma.prisma ?? new PrismaClient({
    log: [...logLevel],
    datasources: {
      db: {
        url: connectionUrl,
      },
    },
    // Error formatting for better debugging
    errorFormat: 'pretty',
  });

  // Cache instance in development to prevent hot-reload issues
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaInstance;
  }

  console.log('[Database] Prisma Client created successfully');

} catch (error) {
  console.error('[Database] ========================================');
  console.error('[Database] FATAL: Failed to create Prisma Client');
  console.error('[Database] ========================================');
  if (error instanceof Error) {
    console.error('[Database] Error:', error.message);
    console.error('[Database] Stack:', error.stack);
  } else {
    console.error('[Database] Error:', error);
  }
  throw error;
}

// ============================================
// CONNECTION TEST & HEALTH CHECK
// ============================================

/**
 * Test database connection with retry logic
 * @param maxRetries Number of retry attempts
 * @param retryDelay Delay between retries in ms
 * @returns Promise<boolean> - true if connected successfully
 */
export async function testDatabaseConnection(
  maxRetries = 3,
  retryDelay = 2000
): Promise<{ success: boolean; error?: string; latency?: number }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Database] Connection test attempt ${attempt}/${maxRetries}...`);

      const startTime = Date.now();
      await prismaInstance.$queryRaw`SELECT 1 as test`;
      const latency = Date.now() - startTime;

      console.log(`[Database] Connection successful! Latency: ${latency}ms`);
      return { success: true, latency };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Database] Connection attempt ${attempt} failed:`, errorMessage);

      if (attempt < maxRetries) {
        console.log(`[Database] Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        return { success: false, error: errorMessage };
      }
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Get detailed database health information
 */
export async function getDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy' | 'degraded';
  connected: boolean;
  latency?: number;
  error?: string;
  details: {
    hostname: string;
    port: string;
    database: string;
    usesPgBouncer: boolean;
  };
}> {
  const details = {
    hostname: parsedDbUrl.hostname,
    port: parsedDbUrl.port || '5432',
    database: parsedDbUrl.pathname.replace('/', '') || 'postgres',
    usesPgBouncer: parsedDbUrl.searchParams.get('pgbouncer') === 'true',
  };

  try {
    const startTime = Date.now();
    await prismaInstance.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;

    return {
      status: latency > 1000 ? 'degraded' : 'healthy',
      connected: true,
      latency,
      details,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details,
    };
  }
}

// Auto-test connection in production (non-blocking)
if (process.env.NODE_ENV === 'production') {
  console.log('[Database] Testing connection in background...');

  testDatabaseConnection(3, 3000)
    .then(result => {
      if (result.success) {
        console.log(`[Database] ✓ Database connected successfully (latency: ${result.latency}ms)`);
      } else {
        console.error('[Database] ✗ Database connection failed after retries:', result.error);
        console.error('[Database] The API will continue running but database queries will fail');
        console.error('[Database] Please check:');
        console.error('[Database]   1. DATABASE_URL is correctly configured in Render');
        console.error('[Database]   2. The database server is running and accessible');
        console.error('[Database]   3. Network/firewall allows connections from Render');
      }
    })
    .catch(err => {
      console.error('[Database] Connection test threw unexpected error:', err);
    });
}

export const prisma = prismaInstance;

// ============================================
// SUPABASE CLIENT (OPTIONAL)
// ============================================

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
    console.warn('[Database] Supabase initialization failed:', error);
    supabase = null;
  }
} else {
  console.log('[Database] Supabase not configured (optional)');
}

export { supabase };

// ============================================
// EXPORTS
// ============================================

export * from '@prisma/client';
export default prisma;
