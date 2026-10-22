import { afterEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import config from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { requireSiteProxy } from './requireSiteProxy.js';

const SECRET = 'a-shared-proxy-secret-of-at-least-32-chars';

function run(path: string, signature?: string): unknown {
  const req = { path, get: (name: string) => (name.toLowerCase() === 'x-nf-sign' ? signature : undefined) } as Request;
  const next = vi.fn();
  requireSiteProxy(req, {} as Response, next);
  return next.mock.calls[0]?.[0];
}

const netlifySignature = (secret = SECRET, expiresIn = 60) =>
  jwt.sign({ iss: 'netlify', site_url: 'https://site.netlify.app', deploy_context: 'production' }, secret, { algorithm: 'HS256', expiresIn });

describe('requireSiteProxy', () => {
  const original = config.netlifyProxySecret;
  afterEach(() => { config.netlifyProxySecret = original; });

  it('lets everything through when no secret is configured (local development)', () => {
    config.netlifyProxySecret = '';
    expect(run('/auth/login')).toBeUndefined();
  });

  it('accepts requests signed by the website proxy', () => {
    config.netlifyProxySecret = SECRET;
    expect(run('/auth/login', netlifySignature())).toBeUndefined();
  });

  it('refuses direct, wrongly signed, expired and unsigned-algorithm requests', () => {
    config.netlifyProxySecret = SECRET;
    expect(run('/auth/login')).toBeInstanceOf(ApiError);
    expect(run('/auth/login', netlifySignature('another-secret-that-is-also-32-chars-long'))).toBeInstanceOf(ApiError);
    expect(run('/auth/login', netlifySignature(SECRET, -10))).toBeInstanceOf(ApiError);
    const unsigned = jwt.sign({ iss: 'netlify' }, '', { algorithm: 'none' } as jwt.SignOptions);
    expect(run('/auth/login', unsigned)).toBeInstanceOf(ApiError);
  });

  it('keeps the health check reachable for the keep-alive monitor', () => {
    config.netlifyProxySecret = SECRET;
    expect(run('/health')).toBeUndefined();
  });
});
