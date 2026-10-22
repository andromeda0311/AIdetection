import type { RequestHandler } from 'express';
import { logger } from '../utils/logger.js';

/** High-frequency ingest from the Python YOLO loop — skip INFO spam. */
function isYoloDetectionIngest(req: { method: string; originalUrl: string }): boolean {
  return req.method === 'POST' && req.originalUrl.startsWith('/api/yolo/detection');
}

export const requestLogger: RequestHandler = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const entry = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
      ip: req.ip,
    };

    if (isYoloDetectionIngest(req)) {
      logger.debug(entry);
      return;
    }

    logger.info(entry);
  });
  next();
};
