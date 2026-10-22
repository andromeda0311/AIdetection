import {
  createUser,
  findByEmail,
  findById,
  listUsers,
  toSafeStaffUser,
  updateUser,
  type SafeStaffUser,
  type UpdateStaffData,
} from '../models/StaffUser.js';
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
import type { CreateStaffInput, UpdateStaffInput } from '../dto/staff.dto.js';
import type { Role } from '../types/authUser.js';

export interface LoginParams {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RegisterParams {
  firstName: string;
  lastName: string;
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

export async function login(params: LoginParams): Promise<AuthResult> {
  const user = await findByEmail(params.email);

  const valid = user ? await verifyPassword(params.password, user.password_hash) : false;
  if (!user || !valid) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  if (!user.is_active) {
    throw ApiError.forbidden('This account has been disabled.');
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

/**
 * Public self-registration. Role is always forced to 'staff' —
 * admin accounts must be created through the admin panel or seed script.
 */
export async function register(params: RegisterParams): Promise<AuthResult> {
  const email = params.email.toLowerCase().trim();
  const existing = await findByEmail(email);
  if (existing) {
    throw ApiError.conflict('EMAIL_TAKEN', 'An account with this email already exists.');
  }

  const passwordHash = await hashPassword(params.password);
  const user = await createUser({
    email,
    passwordHash,
    firstName: params.firstName,
    lastName: params.lastName,
    role: 'staff',
  });

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
  if (!user) {
    throw ApiError.unauthorized('User no longer exists.');
  }
  if (!user.is_active) {
    throw ApiError.forbidden('This account has been disabled.');
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

export async function listStaff(): Promise<SafeStaffUser[]> {
  const users = await listUsers();
  return users.map(toSafeStaffUser);
}

export async function createStaff(input: CreateStaffInput): Promise<SafeStaffUser> {
  const email = input.email.toLowerCase().trim();
  const existing = await findByEmail(email);
  if (existing) {
    throw ApiError.conflict('EMAIL_TAKEN', 'A staff account with this email already exists.');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await createUser({
    email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
  });

  return toSafeStaffUser(user);
}

export async function updateStaff(id: string, input: UpdateStaffInput): Promise<SafeStaffUser> {
  const existing = await findById(id);
  if (!existing) {
    throw ApiError.notFound('Staff account not found.');
  }

  const data: UpdateStaffData = {
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    isActive: input.isActive,
  };

  const updated = await updateUser(id, data);
  return toSafeStaffUser(updated ?? existing);
}

export async function deactivateStaff(id: string): Promise<void> {
  const existing = await findById(id);
  if (!existing) {
    throw ApiError.notFound('Staff account not found.');
  }

  await updateUser(id, { isActive: false });
}

export function isAdminRole(role: Role): boolean {
  return role === 'admin';
}
