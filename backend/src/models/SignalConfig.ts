import { AppDataSource } from '../config/ormconfig.js';
import { SignalConfig } from '../entities/SignalConfig.js';

const repo = () => AppDataSource.getRepository(SignalConfig);

export interface SignalConfigData {
  detectionThresholdMs?: number | null;
  yellowMs: number;
  redMs: number;
  mode?: 'auto' | 'manual';
  manualGreenMs?: number | null;
  manualYellowMs?: number | null;
  manualRedMs?: number | null;
  manualPedWalkMs?: number | null;
}

export async function getConfig(): Promise<SignalConfig | null> {
  return repo().findOne({ where: { id: 1 } });
}

export async function upsertConfig(data: SignalConfigData): Promise<SignalConfig> {
  const entity = repo().create({ id: 1, ...data });
  return repo().save(entity);
}