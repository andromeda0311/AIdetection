import type { Request, Response } from 'express';
import { AppDataSource } from '../config/ormconfig.js';
import { trafficSignal } from '../services/trafficSignal.service.js';
import { listSignalEvents } from '../models/SignalEvent.js';
import { sendSuccess } from '../utils/response.js';
import { SignalStateEnum } from '../entities/SignalEvent.js';
import type { SignalOptions } from '../services/trafficSignal.service.js';

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

 /**
  * The automatic-cycle timings (defaults filled in by the machine) plus the
  * operating mode and manual timers. Both GET and PUT answer with this shape.
  */
function signalConfigPayload() {
  const opts = trafficSignal.getOptions();
  const manual = trafficSignal.getManualTimers();
  return {
    detectionThresholdMs: opts.detectionThresholdMs,
    yellowMs: opts.yellowMs,
    redMs: opts.redMs,
    mode: trafficSignal.getMode(),
    manualGreenMs: manual.greenMs,
    manualYellowMs: manual.yellowMs,
    manualRedMs: manual.redMs,
    manualPedWalkMs: manual.pedWalkMs,
  };
}

export async function getSignalConfig(_req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, 200, 'Signal config.', signalConfigPayload());
}

export async function updateSignalConfig(req: Request, res: Response): Promise<Response> {
  // The route validation guarantees at least one timing is present and within
  // range; this handler persists the subset and applies it to the engine.
  const { detectionThresholdMs, yellowMs, redMs } = req.body as {
    detectionThresholdMs?: number;
    yellowMs?: number;
    redMs?: number;
  };
  const timings: Partial<SignalOptions> = {};
  if (detectionThresholdMs !== undefined) timings.detectionThresholdMs = detectionThresholdMs;
  if (yellowMs !== undefined) timings.yellowMs = yellowMs;
  if (redMs !== undefined) timings.redMs = redMs;
  await trafficSignal.updateOptions(timings);
  return sendSuccess(res, 200, 'Signal config updated.', signalConfigPayload());
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