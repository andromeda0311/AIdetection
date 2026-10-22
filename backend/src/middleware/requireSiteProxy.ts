import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import config from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const SITE_SIGNATURE_HEADER = 'x-nf-sign';

/** Paths under /api that stay reachable without the website (keep-alive and health checks). */
const UNSIGNED_PATHS = new Set(['/health']);

/**
 * With NETLIFY_PROXY_SECRET set, /api/* only accepts requests that came through the
 * website's Netlify proxy, which signs each one (HS256 JWS in `x-nf-sign`, with an
 * expiry). Direct calls to the backend are refused, so nobody can bypass the site
 * or fake the X-Forwarded-For chain the login rate limit relies on.
 * Without the secret (local development) every request passes.
 */
export const requireSiteProxy: RequestHandler = (req, _res, next) => {
  const secret = config.netlifyProxySecret;
  if (!secret || UNSIGNED_PATHS.has(req.path)) return next();

  const signature = req.get(SITE_SIGNATURE_HEADER);
  if (!signature) return next(ApiError.forbidden('Use the website to access this service.'));

  try {
    jwt.verify(signature, secret, { algorithms: ['HS256'] });
    return next();
  } catch {
    return next(ApiError.forbidden('Use the website to access this service.'));
  }
};
