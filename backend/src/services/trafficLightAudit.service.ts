import { AppDataSource } from '../config/ormconfig.js';
import { TrafficLightAuditLog, ArduinoTransportEnum } from '../entities/TrafficLightAuditLog.js';
import { SignalStateEnum, TriggeredByEnum } from '../entities/SignalEvent.js';
import { getSignalIo } from './yoloLive.instance.js';

export interface LogArduinoActivationData {
  signalEventId: string;
  state: SignalStateEnum;
  triggeredBy: TriggeredByEnum;
  detectionId?: string | null;
  transport: ArduinoTransportEnum;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

const repo = () => AppDataSource.getRepository(TrafficLightAuditLog);

export async function logArduinoActivation(data: LogArduinoActivationData): Promise<TrafficLightAuditLog> {
  const entity = repo().create({
    signalEventId: data.signalEventId,
    state: data.state,
    triggeredBy: data.triggeredBy,
    detectionId: data.detectionId ?? null,
    arduinoTransport: data.transport,
    userId: data.userId ?? null,
    metadata: data.metadata ?? null,
  });

  const saved = await repo().save(entity);

  // Emit real-time event via SignalR (Socket.IO)
  getSignalIo()?.emit('traffic:audit', {
    id: saved.id,
    state: saved.state,
    triggeredBy: saved.triggeredBy,
    detectionId: saved.detectionId,
    arduinoTransport: saved.arduinoTransport,
    userId: saved.userId,
    createdAt: saved.createdAt,
  });

  return saved;
}

export async function listTrafficLightAuditLogs(
  limit: number,
  offset: number,
  filters?: { state?: SignalStateEnum; triggeredBy?: TriggeredByEnum; startDate?: Date; endDate?: Date }
): Promise<{ items: TrafficLightAuditLog[]; total: number }> {
  const qb = repo().createQueryBuilder('audit')
    .leftJoinAndSelect('audit.signalEvent', 'signalEvent')
    .leftJoinAndSelect('audit.detection', 'detection')
    .leftJoinAndSelect('audit.user', 'user')
    .orderBy('audit.createdAt', 'DESC')
    .take(limit)
    .skip(offset);

  if (filters?.state) {
    qb.andWhere('audit.state = :state', { state: filters.state });
  }
  if (filters?.triggeredBy) {
    qb.andWhere('audit.triggeredBy = :triggeredBy', { triggeredBy: filters.triggeredBy });
  }
  if (filters?.startDate) {
    qb.andWhere('audit.createdAt >= :startDate', { startDate: filters.startDate });
  }
  if (filters?.endDate) {
    qb.andWhere('audit.createdAt <= :endDate', { endDate: filters.endDate });
  }

  const [items, total] = await qb.getManyAndCount();
  return { items, total };
}

export async function exportTrafficLightAuditLogsCsv(
  res: any,
  filters?: { state?: SignalStateEnum; triggeredBy?: TriggeredByEnum; startDate?: Date; endDate?: Date }
): Promise<void> {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="traffic-light-audit-logs.csv"');
  res.write('timestamp,state,triggered_by,detection_id,arduino_transport,user_id,metadata\n');

  const qb = repo().createQueryBuilder('audit')
    .leftJoinAndSelect('audit.signalEvent', 'signalEvent')
    .leftJoinAndSelect('audit.detection', 'detection')
    .leftJoinAndSelect('audit.user', 'user')
    .orderBy('audit.createdAt', 'ASC');

  if (filters?.state) {
    qb.andWhere('audit.state = :state', { state: filters.state });
  }
  if (filters?.triggeredBy) {
    qb.andWhere('audit.triggeredBy = :triggeredBy', { triggeredBy: filters.triggeredBy });
  }
  if (filters?.startDate) {
    qb.andWhere('audit.createdAt >= :startDate', { startDate: filters.startDate });
  }
  if (filters?.endDate) {
    qb.andWhere('audit.createdAt <= :endDate', { endDate: filters.endDate });
  }

  const rows = await qb.getMany();

  for (const row of rows) {
    const ts = new Date(row.createdAt).toISOString();
    const meta = row.metadata ? JSON.stringify(row.metadata).replace(/"/g, '""') : '';
    res.write(`${ts},${row.state},${row.triggeredBy},${row.detectionId ?? ''},${row.arduinoTransport},${row.userId ?? ''},"${meta}"\n`);
  }
  res.end();
}