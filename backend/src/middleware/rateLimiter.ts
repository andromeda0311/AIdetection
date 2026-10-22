import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import config from '../config/env.js';

const isDev = config.nodeEnv === 'development';

function createLimiter(options: { windowMs: number; limit: number; message: string }): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
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

/** Login brute-force protection only — do not apply to refresh/logout. */
export const loginRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 100 : 30,
  message: 'Too many authentication attempts, please try again later.',
});

/** Registration brute-force protection — separate bucket from login. */
export const registerRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 50 : 20,
  message: 'Too many registration attempts, please try again later.',
});

/** High-frequency YOLO detection ingest — separate generous bucket. */
export const yoloIngestRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: isDev ? 600 : 300,
  message: 'YOLO detection ingest rate limit exceeded.',
});

/** Skip general API limiter for the Python YOLO POST loop. */
export function apiRateLimiterUnlessYoloIngest(req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1], next: Parameters<RequestHandler>[2]): void {
  const isYoloIngest =
    req.method === 'POST' &&
    (req.path === '/yolo/detection' || req.originalUrl.startsWith('/api/yolo/detection'));
  if (isYoloIngest) {
    next();
    return;
  }
  apiRateLimiter(req, res, next);
}
