import { AppDataSource } from '../config/ormconfig.js';
import { RefreshToken } from '../entities/RefreshToken.js';
import { IsNull } from 'typeorm';

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
  ip_address: string | null;
  user_agent: string | null;
}

export interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

const repo = () => AppDataSource.getRepository(RefreshToken);

function mapEntity(entity: RefreshToken): RefreshTokenRecord {
  return {
    id: entity.id,
    user_id: entity.userId,
    token_hash: entity.tokenHash,
    expires_at: entity.expiresAt,
    revoked_at: entity.revokedAt,
    created_at: entity.createdAt,
    ip_address: entity.ipAddress,
    user_agent: entity.userAgent,
  };
}

export async function createRefreshToken(data: CreateRefreshTokenData): Promise<RefreshTokenRecord> {
  const entity = repo().create({
    userId: data.userId,
    tokenHash: data.tokenHash,
    expiresAt: data.expiresAt,
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null,
  });
  const saved = await repo().save(entity);
  return mapEntity(saved);
}

export async function findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
  const entity = await repo().findOne({ where: { tokenHash } });
  return entity ? mapEntity(entity) : null;
}

export async function revokeById(id: string): Promise<void> {
  await repo().update(id, { revokedAt: new Date() });
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await repo().update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
}