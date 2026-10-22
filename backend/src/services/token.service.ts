import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { parseDurationMs } from '../utils/time.js';
import type { Role } from '../types/authUser.js';

interface AccessTokenPayload extends jwt.JwtPayload {
  type: 'access';
  role: Role;
  email: string;
  sub: string;
}

interface RefreshTokenPayload extends jwt.JwtPayload {
  type: 'refresh';
  sub: string;
}

export interface TokenUser {
  id: string;
  email: string;
  role: Role;
}

export function signAccessToken(user: TokenUser): string {
  return jwt.sign({ type: 'access', role: user.role, email: user.email }, config.jwt.accessSecret, {
    subject: user.id,
    expiresIn: config.jwt.accessTtl as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ type: 'refresh' }, config.jwt.refreshSecret, {
    subject: userId,
    expiresIn: config.jwt.refreshTtl as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as jwt.JwtPayload;
    if (payload.type !== 'access' || !payload.sub) {
      throw new Error('Unexpected token type');
    }
    return payload as AccessTokenPayload;
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token.');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, config.jwt.refreshSecret) as jwt.JwtPayload;
    if (payload.type !== 'refresh' || !payload.sub) {
      throw new Error('Unexpected token type');
    }
    return payload as RefreshTokenPayload;
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token.');
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + parseDurationMs(config.jwt.refreshTtl));
}
