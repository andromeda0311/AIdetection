import { AppDataSource } from '../config/ormconfig.js';
import { SignalEvent, SignalStateEnum, TriggeredByEnum } from '../entities/SignalEvent.js';

const repo = () => AppDataSource.getRepository(SignalEvent);

export interface CreateSignalEventData {
  state: SignalStateEnum;
  triggeredBy: TriggeredByEnum;
  detectionId?: string | null;
}

export async function createSignalEvent(data: CreateSignalEventData): Promise<SignalEvent> {
  const entity = repo().create({
    state: data.state,
    triggeredBy: data.triggeredBy,
    detectionId: data.detectionId ?? null,
  });
  return repo().save(entity);
}

export async function listSignalEvents(limit: number): Promise<SignalEvent[]> {
  return repo().find({
    order: { createdAt: 'DESC' },
    take: limit,
  });
}
