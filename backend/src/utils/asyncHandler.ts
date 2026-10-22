import type { RequestHandler } from 'express';

/**
 * Wraps an async route handler so rejected promises are forwarded to the
 * Express error handler (explicit, works across Express 4/5).
 */
export const asyncHandler =
  <P>(fn: RequestHandler<P>): RequestHandler<P> =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
