import type { Request, Response } from 'express';
import {
  exportTrafficLightAuditLogsCsv,
  listTrafficLightAuditLogs,
} from '../services/trafficLightAudit.service.js';
import { sendSuccess } from '../utils/response.js';
import { SignalStateEnum, TriggeredByEnum } from '../entities/SignalEvent.js';

const MAX_LIMIT = 200;

function parseFilters(req: Request): {
  state?: SignalStateEnum;
  triggeredBy?: TriggeredByEnum;
  startDate?: Date;
  endDate?: Date;
} {
  const filters: {
    state?: SignalStateEnum;
    triggeredBy?: TriggeredByEnum;
    startDate?: Date;
    endDate?: Date;
  } = {};

  const state = req.query.state as string | undefined;
  if (state && Object.values(SignalStateEnum).includes(state as SignalStateEnum)) {
    filters.state = state as SignalStateEnum;
  }

  const triggeredBy = req.query.triggeredBy as string | undefined;
  if (triggeredBy && Object.values(TriggeredByEnum).includes(triggeredBy as TriggeredByEnum)) {
    filters.triggeredBy = triggeredBy as TriggeredByEnum;
  }

  const startDate = req.query.startDate as string | undefined;
  if (startDate && !Number.isNaN(new Date(startDate).getTime())) {
    filters.startDate = new Date(startDate);
  }

  const endDate = req.query.endDate as string | undefined;
  if (endDate && !Number.isNaN(new Date(endDate).getTime())) {
    filters.endDate = new Date(endDate);
  }

  return filters;
}

export async function listAudit(req: Request, res: Response): Promise<Response> {
  const limit = Math.min(Number(req.query.limit) || 50, MAX_LIMIT);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const { items, total } = await listTrafficLightAuditLogs(limit, offset, parseFilters(req));
  return sendSuccess(res, 200, 'Audit logs.', { items, total, limit, offset });
}

export async function exportAudit(req: Request, res: Response): Promise<void> {
  await exportTrafficLightAuditLogsCsv(res, parseFilters(req));
}
