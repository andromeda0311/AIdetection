import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import config from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const INGEST_KEY_HEADER = 'x-ingest-key';

function keysMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Protects machine-to-machine ingest (Python YOLO service -> API).
 * With YOLO_INGEST_KEY set, the X-Ingest-Key header must match it.
 * Without it, ingest is only open in development so local setups keep working.
 */
export const requireIngestKey: RequestHandler = (req, _res, next) => {
  const expected = config.yoloLive.ingestKey;

  if (!expected) {
    if (config.nodeEnv === 'development') return next();
    return next(ApiError.unauthorized('Detection ingest is disabled: YOLO_INGEST_KEY is not configured.'));
  }

  const provided = req.get(INGEST_KEY_HEADER) ?? '';
  if (!keysMatch(provided, expected)) {
    return next(ApiError.unauthorized('Invalid ingest key.'));
  }
  return next();
};
