import type { ErrorRequestHandler } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import config from '../config/env.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    const body: Record<string, unknown> = { success: false, message: err.message, code: err.code };
    if (err.details !== undefined) body.details = err.details;
    return res.status(err.statusCode).json(body);
  }

  if (err && typeof err === 'object' && (err as { name?: string }).name === 'MulterError') {
    const code = (err as { code?: string }).code;
    if (code === 'LIMIT_FILE_SIZE') {
      const maxMb = Math.round(config.upload.maxFileSizeBytes / (1024 * 1024));
      return res
        .status(413)
        .json({ success: false, message: `File too large. Maximum allowed size is ${maxMb} MB.`, code });
    }
    return res.status(400).json({ success: false, message: `Upload error: ${code ?? 'unknown'}.`, code: code ?? 'UPLOAD_ERROR' });
  }

  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload.', code: 'INVALID_JSON' });
  }

  logger.error({ err }, 'Unhandled error');
  return res.status(500).json({ success: false, message: 'Internal server error.', code: 'INTERNAL_SERVER_ERROR' });
};
