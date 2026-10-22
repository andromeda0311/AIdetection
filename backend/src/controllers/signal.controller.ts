import type { Request, Response } from 'express';
import { AppDataSource } from '../config/ormconfig.js';
import { trafficSignal } from '../services/trafficSignal.service.js';
import { listSignalEvents } from '../models/SignalEvent.js';
import { sendSuccess } from '../utils/response.js';
import { SignalStateEnum } from '../entities/SignalEvent.js';
import { getConfig } from '../models/SignalConfig.js';

export async function getSignalStatus(_req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, 200, 'Signal status.', {
    ...trafficSignal.getStatus(),
    mode: trafficSignal.getMode(),
    manualTimers: trafficSignal.getManualTimers(),
  });
}

export async function getSignalEvents(req: Request, res: Response): Promise<Response> {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const events = await listSignalEvents(limit);
  return sendSuccess(res, 200, 'Signal event log.', { events });
}

export function forceState(state: SignalStateEnum) {
  return async (req: Request, res: Response): Promise<Response> => {
    await trafficSignal.forceState(state, req.user?.id);
    return sendSuccess(res, 200, `Signal forced to ${state}.`, trafficSignal.getStatus());
  };
}

export async function getSignalConfig(_req: Request, res: Response): Promise<Response> {
  const cfg = await getConfig();
  const opts = trafficSignal.getOptions();
  if (!cfg) {
    return sendSuccess(res, 200, 'Signal config (defaults).', { yellowMs: opts.yellowMs, redMs: opts.redMs });
  }
  return sendSuccess(res, 200, 'Signal config.', {
    yellowMs: cfg.yellowMs,
    redMs: cfg.redMs,
    mode: cfg.mode,
    manualGreenMs: cfg.manualGreenMs,
    manualYellowMs: cfg.manualYellowMs,
    manualRedMs: cfg.manualRedMs,
    manualPedWalkMs: cfg.manualPedWalkMs,
  });
}

export async function updateSignalConfig(req: Request, res: Response): Promise<Response> {
  const { yellowMs, redMs } = req.body as { yellowMs?: number; redMs?: number };
  if (yellowMs === undefined && redMs === undefined) {
    return sendSuccess(res, 400, 'Provide yellowMs and/or redMs.');
  }
  await trafficSignal.updateOptions({ yellowMs, redMs });
  return sendSuccess(res, 200, 'Signal config updated.', trafficSignal.getStatus());
}

// Mode endpoints
export async function getSignalMode(_req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, 200, 'Signal mode.', { mode: trafficSignal.getMode() });
}

export async function setSignalMode(req: Request, res: Response): Promise<Response> {
  const { mode } = req.body as { mode?: 'auto' | 'manual' };
  if (!mode || (mode !== 'auto' && mode !== 'manual')) {
    return sendSuccess(res, 400, 'Provide mode: "auto" or "manual".');
  }
  await trafficSignal.setMode(mode);
  return sendSuccess(res, 200, `Signal mode set to ${mode}.`, { mode: trafficSignal.getMode() });
}

// Manual timers endpoints
export async function getManualTimers(_req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, 200, 'Manual timers.', trafficSignal.getManualTimers());
}

export async function setManualTimers(req: Request, res: Response): Promise<Response> {
  const { greenMs, yellowMs, redMs, pedWalkMs } = req.body as {
    greenMs?: number;
    yellowMs?: number;
    redMs?: number;
    pedWalkMs?: number;
  };
  const timers: Partial<{ greenMs: number; yellowMs: number; redMs: number; pedWalkMs: number }> = {};
  if (greenMs !== undefined) timers.greenMs = greenMs;
  if (yellowMs !== undefined) timers.yellowMs = yellowMs;
  if (redMs !== undefined) timers.redMs = redMs;
  if (pedWalkMs !== undefined) timers.pedWalkMs = pedWalkMs;

  if (Object.keys(timers).length === 0) {
    return sendSuccess(res, 400, 'Provide at least one timer value.');
  }

  await trafficSignal.setManualTimers(timers);
  return sendSuccess(res, 200, 'Manual timers updated.', trafficSignal.getManualTimers());
}

// Force phase with optional custom duration
export async function forcePhase(req: Request, res: Response): Promise<Response> {
  const { state, durationMs } = req.body as { state?: SignalStateEnum; durationMs?: number };
  if (!state || !Object.values(SignalStateEnum).includes(state)) {
    return sendSuccess(res, 400, 'Provide valid state: GREEN, YELLOW, or RED.');
  }
  if (durationMs !== undefined && (durationMs < 1000 || durationMs > 3600000)) {
    return sendSuccess(res, 400, 'Duration must be between 1000ms and 3600000ms.');
  }
  await trafficSignal.forceStateWithDuration(state, durationMs, req.user?.id);
  return sendSuccess(res, 200, `Signal forced to ${state}${durationMs ? ` for ${durationMs}ms` : ''}.`, trafficSignal.getStatus());
}

// Trigger full automated manual cycle
export async function triggerManualCycle(req: Request, res: Response): Promise<Response> {
  await trafficSignal.triggerManualCycle(req.user?.id);
  return sendSuccess(res, 200, 'Manual traffic cycle started.', trafficSignal.getStatus());
}

/** Stream all signal events as CSV (admin only). */
export async function exportSignalEvents(_req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="signal-events.csv"');
  res.write('timestamp,state,triggered_by\n');

  const rows = await AppDataSource.query(
    `SELECT created_at, state, triggered_by
     FROM signal_events
     ORDER BY created_at ASC`
  );

  for (const row of rows) {
    const ts = new Date(row.created_at).toISOString();
    res.write(`${ts},${row.state},${row.triggered_by}\n`);
  }
  res.end();
}