import rateLimit from 'express-rate-limit';
import { RATE_LIMITS } from '@lia360/shared';

// Helper to get client IP (works with proxies)
const getClientIp = (req: any): string => {
  // Try X-Forwarded-For first (most reliable with proxies)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    if (ips) return ips;
  }
  
  // Fallback to other headers
  if (req.headers['cf-connecting-ip']) {
    return req.headers['cf-connecting-ip'] as string;
  }
  
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'] as string;
  }
  
  // Last resort: use req.ip (requires trust proxy)
  return req.ip || 'unknown';
};

export const authRateLimit = rateLimit({
  windowMs: RATE_LIMITS.auth.windowMs,
  max: RATE_LIMITS.auth.max,
  message: {
    success: false,
    error: {
      type: 'rate_limited',
      title: 'Too Many Requests',
      status: 429,
      detail: 'Muitas tentativas. Tente novamente em alguns minutos.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use custom key generator to avoid X-Forwarded-For errors
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    return `auth:${ip}`;
  },
  // Skip rate limiting if we can't determine IP (prevents errors)
  skip: (req) => {
    const ip = getClientIp(req);
    return ip === 'unknown';
  },
});

export const importRateLimit = rateLimit({
  windowMs: RATE_LIMITS.import.windowMs,
  max: RATE_LIMITS.import.max,
  message: {
    success: false,
    error: {
      type: 'rate_limited',
      title: 'Too Many Requests',
      status: 429,
      detail: 'Limite de importações atingido. Tente novamente em alguns minutos.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    return `import:${ip}`;
  },
  skip: (req) => {
    const ip = getClientIp(req);
    return ip === 'unknown';
  },
});

export const defaultRateLimit = rateLimit({
  windowMs: RATE_LIMITS.default.windowMs,
  max: RATE_LIMITS.default.max,
  message: {
    success: false,
    error: {
      type: 'rate_limited',
      title: 'Too Many Requests',
      status: 429,
      detail: 'Muitas requisições. Tente novamente mais tarde.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    const ip = getClientIp(req);
    return `ip:${ip}`;
  },
  skip: (req) => {
    // Skip if we can't determine identity
    if (req.user?.id) return false;
    const ip = getClientIp(req);
    return ip === 'unknown';
  },
});
