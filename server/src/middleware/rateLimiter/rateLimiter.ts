import { isProduction } from 'app/config/env.js';
import rateLimit from 'express-rate-limit';

if (isProduction() && !process.env.RATE_LIMIT_STORAGE_URI) {
  console.warn(
    'WARNING: rate limiter is using in-memory storage in production. ' +
      'Set RATE_LIMIT_STORAGE_URI for a persistent store.',
  );
}

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Per-user limit for the chat/agent endpoint — the most expensive endpoint
 * (triggers multiple Claude API calls + SerpApi calls per request).
 * Keyed by authenticated user ID, not IP.
 * TODO: move to Redis store when scaling horizontally.
 */
export const chatRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anonymous',
  message: {
    error: 'RATE_LIMITED',
    message: 'Please wait before sending another message.',
  },
});

/** Stricter limit for auth routes to resist credential stuffing. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
