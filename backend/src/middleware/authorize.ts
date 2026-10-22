import type { RequestHandler } from 'express';
import { ApiError } from '../utils/ApiError.js';
import type { Role } from '../types/authUser.js';

/**
 * Restricts a route to the given roles. Must run after `authenticate`.
 */
export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden());
    }
    return next();
  };
