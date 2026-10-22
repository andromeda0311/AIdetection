import type { Socket } from 'socket.io';
import config from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from './token.service.js';
import { findById } from '../models/StaffUser.js';
import type { AuthUser } from '../types/authUser.js';

/**
 * Resolves the user for a Socket.IO handshake token, mirroring the HTTP
 * `authenticate` middleware (fresh DB lookup so deactivation applies).
 */
export async function authenticateSocketToken(token: unknown): Promise<AuthUser> {
  if (typeof token !== 'string' || token.length === 0) {
    throw ApiError.unauthorized('Missing access token.');
  }

  const payload = verifyAccessToken(token);
  const user = await findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('User no longer exists.');
  }
  if (!user.is_active || user.role !== 'admin') {
    throw ApiError.unauthorized('This account may not use the system.');
  }

  return { id: user.id, email: user.email, role: user.role };
}

/**
 * Socket.IO middleware: clients pass `auth: { token }` when connecting.
 * In development, connections without a token are allowed as read-only guests
 * so the frontend preview mode (VITE_AUTH_DISABLED) keeps working.
 */
export async function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void> {
  const token = socket.handshake.auth?.token;

  if (!token && config.nodeEnv === 'development') {
    socket.data.user = undefined;
    next();
    return;
  }

  try {
    socket.data.user = await authenticateSocketToken(token);
    next();
  } catch (err) {
    next(new Error(err instanceof Error ? err.message : 'Unauthorized'));
  }
}

export function isAdminSocket(socket: Socket): boolean {
  return (socket.data.user as AuthUser | undefined)?.role === 'admin';
}
