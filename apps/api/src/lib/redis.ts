import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

// Redis client - optional, fallback to in-memory if not available
let redis: Redis | null = null;
let redisDisabled = false;

// In-memory fallback storage
const memoryStore = new Map<string, { value: string; expiresAt?: number }>();

// Initialize Redis only if URL is provided and not empty/default
// Skip Redis if URL is empty, default localhost, or explicitly disabled
const redisUrl = (env.REDIS_URL || '').trim();
const shouldUseRedis = redisUrl !== '' && 
  redisUrl !== 'redis://localhost:6379' &&
  process.env.REDIS_DISABLED !== 'true';

if (shouldUseRedis && !redisDisabled) {
  try {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1, // Only retry once
      retryStrategy: () => null, // Disable automatic retry
      lazyConnect: true,
      enableOfflineQueue: false, // Don't queue commands when offline
      connectTimeout: 2000, // 2 second timeout
      enableReadyCheck: false, // Skip ready check to fail fast
    });

    let connectionAttempted = false;

    redis.on('connect', () => {
      logger.info('✓ Connected to Redis');
    });

    redis.on('ready', () => {
      logger.info('✓ Redis ready');
    });

    redis.on('error', (_err: Error) => {
      // Only log once, then disable Redis
      if (!connectionAttempted) {
        connectionAttempted = true;
        logger.warn('Redis unavailable, using in-memory storage');
      }
      redis = null;
      redisDisabled = true;
    });

    redis.on('close', () => {
      redis = null;
      redisDisabled = true;
    });

    // Try to connect once, with timeout
    const connectPromise = redis.connect();
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 2000);
    });

    Promise.race([connectPromise, timeoutPromise])
      .then(() => {
        logger.info('✓ Redis connected successfully');
      })
      .catch(() => {
        if (!connectionAttempted) {
          connectionAttempted = true;
          logger.warn('Redis connection failed, using in-memory storage');
        }
        const redisInstance = redis;
        redis = null;
        redisDisabled = true;
        // Disconnect to prevent further connection attempts
        if (redisInstance) {
          redisInstance.disconnect();
        }
      });
  } catch (error) {
    logger.warn('Redis not configured, using in-memory storage');
    redis = null;
    redisDisabled = true;
  }
} else {
  // Redis explicitly disabled or not configured - use in-memory silently
  // No logging needed as this is the expected behavior when Redis is not available
}

// Unified storage interface
export const storage = {
  async get(key: string): Promise<string | null> {
    if (redis && !redisDisabled && redis.status === 'ready') {
      try {
        return await redis.get(key);
      } catch {
        // If Redis fails, fall back to memory
        redis = null;
        redisDisabled = true;
      }
    }
    const item = memoryStore.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      memoryStore.delete(key);
      return null;
    }
    return item.value;
  },

  async set(key: string, value: string, exMode?: 'EX', exSeconds?: number): Promise<void> {
    if (redis && !redisDisabled && redis.status === 'ready') {
      try {
        if (exMode === 'EX' && exSeconds) {
          await redis.set(key, value, 'EX', exSeconds);
        } else {
          await redis.set(key, value);
        }
        return;
      } catch {
        // If Redis fails, fall back to memory
        redis = null;
        redisDisabled = true;
      }
    }
    const expiresAt = exSeconds ? Date.now() + exSeconds * 1000 : undefined;
    memoryStore.set(key, { value, expiresAt });
  },

  async del(key: string): Promise<void> {
    if (redis && !redisDisabled && redis.status === 'ready') {
      try {
        await redis.del(key);
        return;
      } catch {
        redis = null;
        redisDisabled = true;
      }
    }
    memoryStore.delete(key);
  },

  async incr(key: string): Promise<number> {
    if (redis && !redisDisabled && redis.status === 'ready') {
      try {
        return await redis.incr(key);
      } catch {
        redis = null;
        redisDisabled = true;
      }
    }
    const current = memoryStore.get(key);
    const newValue = (parseInt(current?.value || '0', 10) + 1).toString();
    memoryStore.set(key, { value: newValue, expiresAt: current?.expiresAt });
    return parseInt(newValue, 10);
  },

  async expire(key: string, seconds: number): Promise<void> {
    if (redis && !redisDisabled && redis.status === 'ready') {
      try {
        await redis.expire(key, seconds);
        return;
      } catch {
        redis = null;
        redisDisabled = true;
      }
    }
    const current = memoryStore.get(key);
    if (current) {
      current.expiresAt = Date.now() + seconds * 1000;
    }
  },
};

export { redis };
