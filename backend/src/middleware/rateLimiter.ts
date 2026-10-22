import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import config from '../config/env.js';

const isDev = config.nodeEnv === 'development';

function createLimiter(options: { windowMs: number; limit: number; message: string; skipSuccessfulRequests?: boolean }): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: options.message, code: 'RATE_LIMITED' },
  });
}

/** General API limit — relaxed in development. */
export const apiRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 10_000 : 500,
  message: 'Too many requests, please try again later.',
});

/**
 * Login brute-force protection — do not apply to refresh/logout.
 * Counts failed attempts only, per client IP: 5 failures lock that IP out of
 * login for 15 minutes; a successful login does not use up the allowance.
 * There is deliberately no per-account lockout: with a single administrator,
 * an attacker could otherwise lock the only account out from anywhere.
 */
export const loginRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 100 : 5,
  skipSuccessfulRequests: true,
  message: 'Too many failed login attempts. Try again in 15 minutes.',
});

/** High-frequency YOLO detection ingest — separate generous bucket. */
export const yoloIngestRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: isDev ? 600 : 300,
  message: 'YOLO detection ingest rate limit exceeded.',
});

/** Skip the general API limiter for the detection feeds (Python loop and browser reports); they use their own bucket. */
export function apiRateLimiterUnlessYoloIngest(req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1], next: Parameters<RequestHandler>[2]): void {
  const isYoloIngest =
    req.method === 'POST' &&
    (req.path === '/yolo/detection' ||
      req.path === '/live/detection' ||
      req.originalUrl.startsWith('/api/yolo/detection') ||
      req.originalUrl.startsWith('/api/live/detection'));
  if (isYoloIngest) {
    next();
    return;
  }
  apiRateLimiter(req, res, next);
}
