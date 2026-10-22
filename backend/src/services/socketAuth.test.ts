import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io';
import { signAccessToken, signRefreshToken } from './token.service.js';

const findById = vi.fn();
vi.mock('../models/StaffUser.js', () => ({ findById: (id: string) => findById(id) }));

const { authenticateSocketToken, isAdminSocket, socketAuthMiddleware } = await import('./socketAuth.js');

const admin = { id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', email: 'admin@thesis.local', role: 'admin' as const };
const staff = { id: 'b1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', email: 'staff@thesis.local', role: 'staff' as const };

function fakeSocket(token?: string): Socket {
  return { handshake: { auth: token === undefined ? {} : { token } }, data: {} } as unknown as Socket;
}

describe('socketAuth', () => {
  beforeEach(() => {
    findById.mockReset();
  });

  it('accepts a valid access token for an active user', async () => {
    findById.mockResolvedValue({ ...admin, is_active: true });
    await expect(authenticateSocketToken(signAccessToken(admin))).resolves.toEqual(admin);
  });

  it('rejects missing, malformed and refresh tokens', async () => {
    await expect(authenticateSocketToken(undefined)).rejects.toThrow();
    await expect(authenticateSocketToken('not-a-token')).rejects.toThrow();
    await expect(authenticateSocketToken(signRefreshToken(admin.id))).rejects.toThrow();
  });

  it('rejects deleted and disabled users', async () => {
    findById.mockResolvedValue(null);
    await expect(authenticateSocketToken(signAccessToken(admin))).rejects.toThrow();
    findById.mockResolvedValue({ ...admin, is_active: false });
    await expect(authenticateSocketToken(signAccessToken(admin))).rejects.toThrow();
  });

  it('middleware rejects a connection without a token outside development', async () => {
    const next = vi.fn();
    await socketAuthMiddleware(fakeSocket(), next);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('refuses any account that is not the administrator', async () => {
    findById.mockResolvedValue({ ...staff, is_active: true });
    await expect(authenticateSocketToken(signAccessToken(staff))).rejects.toThrow(/may not use the system/);
    const next = vi.fn();
    await socketAuthMiddleware(fakeSocket(signAccessToken(staff)), next);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('middleware attaches the administrator', async () => {
    findById.mockResolvedValue({ ...admin, is_active: true });
    const adminSocket = fakeSocket(signAccessToken(admin));
    const next = vi.fn();
    await socketAuthMiddleware(adminSocket, next);
    expect(next).toHaveBeenCalledWith();
    expect(adminSocket.data.user).toEqual(admin);
    expect(isAdminSocket(adminSocket)).toBe(true);
  });
});
