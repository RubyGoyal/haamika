/**
 * Rate limiting for auth and invite endpoints.
 * Uses express-rate-limit with in-memory store.
 */
import rateLimit from 'express-rate-limit';

/** Rate limiter for /api/auth/* — 20 requests per 15 min per IP. */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many attempts. Please try again later.' },
});

/** Rate limiter for /api/invites/accept — 10 requests per 15 min per IP. */
export const inviteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many attempts. Please try again later.' },
});

/** General API rate limiter — 100 requests per minute per IP. */
export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many requests. Please slow down.' },
});
