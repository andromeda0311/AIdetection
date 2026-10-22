import { describe, expect, it } from 'vitest';
import { hashToken, signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from './token.service.js';
import { ApiError } from '../utils/ApiError.js';

const user = { id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', email: 'admin@thesis.local', role: 'admin' as const };

describe('token.service', () => {
  it('signs and verifies an access token', () => {
    const token = signAccessToken(user);
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe(user.id);
    expect(payload.role).toBe('admin');
    expect(payload.type).toBe('access');
  });

  it('signs and verifies a refresh token', () => {
    const token = signRefreshToken(user.id);
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe(user.id);
    expect(payload.type).toBe('refresh');
  });

  it('rejects an invalid access token', () => {
    expect(() => verifyAccessToken('not-a-token')).toThrow(ApiError);
  });

  it('rejects a refresh token used as an access token', () => {
    const refresh = signRefreshToken(user.id);
    expect(() => verifyAccessToken(refresh)).toThrow(ApiError);
  });

  it('hashes tokens deterministically with sha256', () => {
    const hash = hashToken('the-token');
    expect(hash).toBe(hashToken('the-token'));
    expect(hash).toHaveLength(64);
  });
});
