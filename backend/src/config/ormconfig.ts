import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SignalEvent } from '../entities/SignalEvent.js';
import { SignalConfig } from '../entities/SignalConfig.js';
import { StaffUser } from '../entities/StaffUser.js';
import { RefreshToken } from '../entities/RefreshToken.js';
import { Detection } from '../entities/Detection.js';
import { DetectionFrame } from '../entities/DetectionFrame.js';
import { TrafficLightAuditLog } from '../entities/TrafficLightAuditLog.js';
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
  entities: [SignalEvent, SignalConfig, StaffUser, RefreshToken, Detection, DetectionFrame, TrafficLightAuditLog],
  migrations: [migrationsPath],
  subscribers: [],
  ...(config.dbSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

export async function initDB(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
}