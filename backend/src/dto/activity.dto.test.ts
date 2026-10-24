import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { recentActivityQuery } from './activity.dto.js';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../utils/ApiError.js';

function validateQuery(query: unknown): unknown {
  const req = { query } as Request;
  const next = vi.fn();
  validate(recentActivityQuery, 'query')(req as Request, {} as Response, next);
  const error = next.mock.calls[0]?.[0] as ApiError | undefined;
  if (error) return { statusCode: error.statusCode };
  // The middleware stores the parsed values on req.validatedQuery for GET routes.
  return { value: req.validatedQuery };
}

describe('recentActivityQuery', () => {
  it('defaults to 5 items when no limit is sent', () => {
    expect(validateQuery({})).toEqual({ value: { limit: 5 } });
  });

  it('accepts a limit between 1 and 50, including integer strings', () => {
    expect(validateQuery({ limit: '1' })).toEqual({ value: { limit: 1 } });
    expect(validateQuery({ limit: '50' })).toEqual({ value: { limit: 50 } });
  });

  it('rejects out-of-range limits with 422 (GET /activity/recent returns it)', () => {
    expect(validateQuery({ limit: '0' })).toMatchObject({ statusCode: 422 });
    expect(validateQuery({ limit: '51' })).toMatchObject({ statusCode: 422 });
    expect(validateQuery({ limit: '2.5' })).toMatchObject({ statusCode: 422 });
    expect(validateQuery({ limit: 'many' })).toMatchObject({ statusCode: 422 });
  });
});
