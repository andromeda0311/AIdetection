import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SignalEvent } from '../entities/SignalEvent.js';
import { SignalConfig } from '../entities/SignalConfig.js';
import { StaffUser } from '../entities/StaffUser.js';
import { RefreshToken } from '../entities/RefreshToken.js';
import { Detection } from '../entities/Detection.js';
import { DetectionFrame } from '../entities/DetectionFrame.js';
import { TrafficLightAuditLog } from '../entities/TrafficLightAuditLog.js';
import { DetectionActivity } from '../entities/DetectionActivity.js';
import config from './env.js';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const isCompiled = __filename.endsWith('.js');
const migrationsPath = isCompiled ? 'dist/migrations/*.js' : 'src/migrations/*.ts';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: config.databaseUrl,
  synchronize: false,
  logging: config.nodeEnv === 'development',
  entities: [SignalEvent, SignalConfig, StaffUser, RefreshToken, Detection, DetectionFrame, TrafficLightAuditLog, DetectionActivity],
  migrations: [migrationsPath],
  subscribers: [],
  ...(config.dbSsl ? { ssl: { rejectUnauthorized: true } } : {}),
});

export async function initDB(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
}

/**
 * Applies pending migrations (each in its own transaction) and returns their names.
 * Run at startup so a deploy never serves new code against an old schema.
 */
export async function runPendingMigrations(): Promise<string[]> {
  const applied = await AppDataSource.runMigrations({ transaction: 'each' });
  return applied.map((migration) => migration.name);
}