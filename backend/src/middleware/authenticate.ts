import type { RequestHandler } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../services/token.service.js';
import { findById } from '../models/StaffUser.js';

/**
 * Verifies the Bearer access token and attaches the current user to req.user.
 * Loads the user fresh from the DB so role changes and deactivation apply immediately.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing or malformed Authorization header.');
    }

    const token = header.slice('Bearer '.length).trim();
    const payload = verifyAccessToken(token);

    const user = await findById(payload.sub);
    if (!user) {
      throw ApiError.unauthorized('User no longer exists.');
    }
    if (!user.is_active) {
      throw ApiError.forbidden('This account has been disabled.');
    }

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
};
