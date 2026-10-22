import { findByEmail, findById, toSafeStaffUser, type SafeStaffUser, type StaffUserRecord } from '../models/StaffUser.js';
import {
  createRefreshToken,
  findByTokenHash,
  revokeAllForUser,
  revokeById,
} from '../models/RefreshToken.js';
import {
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './token.service.js';
import { hashPassword, verifyPassword } from './password.service.js';
import { ApiError } from '../utils/ApiError.js';
import type { Role } from '../types/authUser.js';

/*
 * Access model: the system has exactly one account, the administrator (created by
 * `npm run db:seed:prod`). There is no self-registration and no staff management.
 * Accounts with any other role (e.g. registered before registration was removed)
 * can neither log in nor refresh a session.
 */

export interface LoginParams {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthResult {
  user: SafeStaffUser;
  accessToken: string;
  refreshToken: string;
}

const INVALID_CREDENTIALS = 'Invalid email or password.';

export function isAdminRole(role: Role): boolean {
  return role === 'admin';
}

// Compared against when the email is unknown, so a wrong email takes as long as a
// wrong password and response timing does not reveal which accounts exist.
let dummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword('dummy-password-for-constant-time-login');
  return dummyHash;
}

/** True only for an active administrator. */
function mayUseSystem(user: StaffUserRecord): boolean {
  return user.is_active && isAdminRole(user.role);
}

export async function login(params: LoginParams): Promise<AuthResult> {
  const user = await findByEmail(params.email);
  const valid = await verifyPassword(params.password, user ? user.password_hash : await getDummyHash());

  // Same message for unknown email, wrong password, disabled or non-admin account:
  // the response never confirms that an account exists.
  if (!user || !valid || !mayUseSystem(user)) {
    throw ApiError.unauthorized(INVALID_CREDENTIALS);
  }

  const refreshToken = signRefreshToken(user.id);
  await createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshTokenExpiry(),
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return {
    user: toSafeStaffUser(user),
    accessToken: signAccessToken({ id: user.id, email: user.email, role: user.role }),
    refreshToken,
  };
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);
  const record = await findByTokenHash(tokenHash);

  if (!record || record.revoked_at || record.expires_at.getTime() <= Date.now()) {
    // Valid JWT but no active record -> the token was likely reused or revoked.
    await revokeAllForUser(payload.sub);
    throw ApiError.unauthorized('Refresh token is no longer valid. Please log in again.');
  }

  const user = await findById(record.user_id);
  if (!user || !mayUseSystem(user)) {
    await revokeAllForUser(record.user_id);
    throw ApiError.unauthorized('Session is no longer valid. Please log in again.');
  }

  // Rotation: revoke the used token and issue a fresh one.
  await revokeById(record.id);

  const newRefreshToken = signRefreshToken(user.id);
  await createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(newRefreshToken),
    expiresAt: refreshTokenExpiry(),
  });

  return {
    user: toSafeStaffUser(user),
    accessToken: signAccessToken({ id: user.id, email: user.email, role: user.role }),
    refreshToken: newRefreshToken,
  };
}

export async function logout(refreshToken: string): Promise<void> {
  const record = await findByTokenHash(hashToken(refreshToken));
  if (record && !record.revoked_at) {
    await revokeById(record.id);
  }
}
