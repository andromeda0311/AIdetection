import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { updateSignalConfigSchema } from './signal.dto.js';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../utils/ApiError.js';

function validateBody(body: unknown): unknown {
  const req = { body } as Request;
  const next = vi.fn();
  validate(updateSignalConfigSchema)(req as Request, {} as Response, next);
  const error = next.mock.calls[0]?.[0] as ApiError | undefined;
  if (error) return { statusCode: error.statusCode, details: error.details };
  // The middleware stores the parsed values back on req.body.
  return { value: req.body };
}

describe('updateSignalConfigSchema', () => {
  it('accepts a valid subset of the automatic-cycle timings', () => {
    const result = validateBody({ redMs: 22000 });
    expect(result).toEqual({ value: { redMs: 22000 } });

    expect(
      validateBody({ detectionThresholdMs: 5000, yellowMs: 4000, redMs: 15000 }),
    ).toEqual({ value: { detectionThresholdMs: 5000, yellowMs: 4000, redMs: 15000 } });
  });

  it('rejects out-of-range values with 422', () => {
    expect(validateBody({ detectionThresholdMs: 999 })).toMatchObject({ statusCode: 422 });
    expect(validateBody({ yellowMs: 61000 })).toMatchObject({ statusCode: 422 });
    expect(validateBody({ redMs: 300001 })).toMatchObject({ statusCode: 422 });
    expect(validateBody({ redMs: 4999 })).toMatchObject({ statusCode: 422 });
  });

  it('rejects non-integer milliseconds with 422', () => {
    expect(validateBody({ detectionThresholdMs: 5500.5 })).toMatchObject({ statusCode: 422 });
    expect(validateBody({ yellowMs: '4000' })).toMatchObject({ statusCode: 422 });
  });

  it('rejects an empty payload with 422', () => {
    expect(validateBody({})).toMatchObject({ statusCode: 422 });
    // Unknown fields are stripped, so an unrelated object is still empty.
    expect(validateBody({ mode: 'manual' })).toMatchObject({ statusCode: 422 });
  });
});
