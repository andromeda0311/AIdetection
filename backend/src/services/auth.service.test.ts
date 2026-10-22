import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from './password.service.js';
import { hashToken, signRefreshToken } from './token.service.js';
import { adminPasswordProblem } from './adminPolicy.js';

const users = new Map<string, Record<string, unknown>>();
const tokens = new Map<string, Record<string, unknown>>();
const revokedUsers: string[] = [];

vi.mock('../models/StaffUser.js', () => ({
  findByEmail: async (email: string) => [...users.values()].find((u) => u.email === email) ?? null,
  findById: async (id: string) => users.get(id) ?? null,
  toSafeStaffUser: (u: Record<string, unknown>) => ({ id: u.id, email: u.email, role: u.role }),
}));
vi.mock('../models/RefreshToken.js', () => ({
  createRefreshToken: async (data: { userId: string; tokenHash: string; expiresAt: Date }) => {
    tokens.set(data.tokenHash, { id: data.tokenHash, user_id: data.userId, revoked_at: null, expires_at: data.expiresAt });
  },
  findByTokenHash: async (hash: string) => tokens.get(hash) ?? null,
  revokeAllForUser: async (userId: string) => { revokedUsers.push(userId); },
  revokeById: async (id: string) => { const t = tokens.get(id); if (t) t.revoked_at = new Date(); },
}));

const { login, refresh } = await import('./auth.service.js');

const PASSWORD = 'Correct-horse-42';
async function addUser(id: string, email: string, role: 'admin' | 'staff', isActive = true) {
  users.set(id, { id, email, role, is_active: isActive, password_hash: await hashPassword(PASSWORD) });
}

describe('single-administrator login rules', () => {
  beforeEach(async () => {
    users.clear();
    tokens.clear();
    revokedUsers.length = 0;
    await addUser('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'admin@site.test', 'admin');
    await addUser('b1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'registered@site.test', 'staff');
    await addUser('c1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'old-admin@site.test', 'admin', false);
  });

  it('lets the active administrator log in', async () => {
    const result = await login({ email: 'admin@site.test', password: PASSWORD });
    expect(result.user.role).toBe('admin');
    expect(result.accessToken).toBeTruthy();
  });

  it('gives the same answer for a wrong password, unknown email, non-admin or disabled account', async () => {
    const attempts = [
      { email: 'admin@site.test', password: 'wrong-password-1' },
      { email: 'nobody@site.test', password: PASSWORD },
      { email: 'registered@site.test', password: PASSWORD },
      { email: 'old-admin@site.test', password: PASSWORD },
    ];
    for (const attempt of attempts) {
      await expect(login(attempt)).rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password.' });
    }
  });

  it('takes about as long for an unknown email as for a wrong password', async () => {
    const time = async (email: string) => {
      const start = performance.now();
      await login({ email, password: 'wrong-password-1' }).catch(() => undefined);
      return performance.now() - start;
    };
    await time('nobody@site.test'); // warm up the dummy hash
    const unknown = await time('nobody@site.test');
    const known = await time('admin@site.test');
    expect(unknown).toBeGreaterThan(known * 0.4);
  });

  it('refuses to refresh a session of a non-admin account and revokes its sessions', async () => {
    const userId = 'b1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
    const token = signRefreshToken(userId);
    tokens.set(hashToken(token), { id: hashToken(token), user_id: userId, revoked_at: null, expires_at: new Date(Date.now() + 60_000) });
    await expect(refresh(token)).rejects.toMatchObject({ statusCode: 401 });
    expect(revokedUsers).toContain(userId);
  });
});

describe('administrator password rule', () => {
  it('requires 12+ characters with a letter and a number', () => {
    expect(adminPasswordProblem('short1')).toMatch(/12 characters/);
    expect(adminPasswordProblem('alllettersonly')).toMatch(/letter and one number/);
    expect(adminPasswordProblem('123456789012')).toMatch(/letter and one number/);
    expect(adminPasswordProblem('Strong-Admin-2026')).toBeNull();
  });
});
