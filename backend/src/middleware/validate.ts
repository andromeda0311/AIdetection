import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError.js';

type Source = 'body' | 'params' | 'query';

/**
 * Validates request input. Express 5 makes `query` and `params` read-only, so
 * parsed values are stored on `req.validatedQuery` / `req.validatedParams`.
 */
export function validate<T>(schema: ZodSchema<T>, source: Source = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(
        new ApiError(422, 'VALIDATION_ERROR', 'Invalid request payload.', result.error.issues),
      );
    }

    if (source === 'body') {
      req.body = result.data;
    } else if (source === 'query') {
      req.validatedQuery = result.data;
    } else {
      req.validatedParams = {
        ...(req.validatedParams ?? {}),
        ...(result.data as Record<string, unknown>),
      };
    }

    return next();
  };
}
