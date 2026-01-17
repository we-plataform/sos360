import rateLimit from 'express-rate-limit';
import { RATE_LIMITS } from '@sos360/shared';

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
  keyGenerator: (req) => req.user?.id || req.ip || 'anonymous',
});
