import { z } from 'zod';

console.log('[Config] Validating environment variables...');
console.log('[Config] Available env vars:', Object.keys(process.env).filter(k =>
  k.startsWith('DATABASE') ||
  k.startsWith('JWT') ||
  k.startsWith('CORS') ||
  k.startsWith('NODE') ||
  k.startsWith('PORT') ||
  k.startsWith('REDIS')
).join(', '));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').refine(
    (val) => {
      try {
        const url = new URL(val);
        return url.hostname && url.hostname.length > 0;
      } catch {
        return false;
      }
    },
    { message: 'DATABASE_URL must be a valid PostgreSQL connection string with hostname' }
  ),
  DIRECT_URL: z.string().optional(),
  REDIS_URL: z.string().default(''),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((val) => val.split(',').map((origin) => origin.trim()).filter(Boolean)),
  OPENAI_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('=== FATAL: Invalid environment variables ===');
  console.error('Errors:', JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  console.error('');
  console.error('Required variables:');
  console.error('  - DATABASE_URL: PostgreSQL connection string');
  console.error('  - JWT_SECRET: Secret key for JWT (min 32 chars)');
  console.error('');
  console.error('Current values (redacted):');
  console.error('  - DATABASE_URL:', process.env.DATABASE_URL ? `set (${process.env.DATABASE_URL.length} chars)` : 'NOT SET');
  console.error('  - JWT_SECRET:', process.env.JWT_SECRET ? `set (${process.env.JWT_SECRET.length} chars)` : 'NOT SET');
  console.error('  - PORT:', process.env.PORT || 'NOT SET (will use default 3001)');
  console.error('  - NODE_ENV:', process.env.NODE_ENV || 'NOT SET (will use default development)');
  console.error('  - CORS_ORIGINS:', process.env.CORS_ORIGINS || 'NOT SET (will use default)');
  process.exit(1);
}

console.log('[Config] Environment validated successfully');
console.log('[Config] NODE_ENV:', parsed.data.NODE_ENV);
console.log('[Config] PORT:', parsed.data.PORT);
console.log('[Config] CORS_ORIGINS:', parsed.data.CORS_ORIGINS.join(', '));

export const env = parsed.data;
