import config from '../config/env.js';
import { logger } from '../utils/logger.js';
import { createSignalEvent } from '../models/SignalEvent.js';
import { appEvents, DETECTION_COMPLETED, type DetectionCompletedEvent } from './events.js';
import { getConfig, upsertConfig, type SignalConfigData } from '../models/SignalConfig.js';
import { SignalStateEnum, TriggeredByEnum } from '../entities/SignalEvent.js';
import { SignalEvent } from '../entities/SignalEvent.js';
import { logArduinoActivation } from './trafficLightAudit.service.js';
import { ArduinoTransportEnum } from '../entities/TrafficLightAuditLog.js';
import { getSignalIo, yoloLive as liveEngine } from './yoloLive.instance.js';
import type { SignalPhase, SignalTransition, SignalTransitionTrigger, TrafficSignalEngine } from './yoloLive.service.js';

export interface SignalOptions {
  /** How long a person must be seen before the caution (yellow) phase. */
  detectionThresholdMs: number;
  yellowMs: number;
  redMs: number;
}

export interface TransitionLog {
  state: SignalStateEnum;
  triggeredBy: TriggeredByEnum;
  detectionId: string | null;
}

export interface ManualTimers {
  greenMs: number;
  yellowMs: number;
  redMs: number;
  pedWalkMs: number;
}

type SignalMode = 'auto' | 'manual';

function stateFromPhase(phase: SignalPhase): SignalStateEnum {
  switch (phase) {
    case 'YELLOW':
      return SignalStateEnum.YELLOW;
    case 'RED':
      return SignalStateEnum.RED;
    default:
      return SignalStateEnum.GREEN;
  }
}

function triggeredByFrom(trigger: SignalTransitionTrigger): TriggeredByEnum {
  return trigger === 'auto' ? TriggeredByEnum.AUTO : TriggeredByEnum.ADMIN;
}

/** Audit rows must reflect where the commands really go: the live YOLO Arduino transport. */
function auditTransport(transport: 'log' | 'serial'): ArduinoTransportEnum {
  return transport === 'serial' ? ArduinoTransportEnum.SERIAL : ArduinoTransportEnum.LOG;
}

/**
 * Coordinates the single live traffic-light engine (YoloLiveService): operating
 * mode, admin manual commands, timer settings and persistence. It never drives
 * the light itself — durations, timers and Arduino commands belong to the
 * engine — and the SignalEvent rows, the audit log and the `signal:update`
 * broadcasts are recorded from the transitions the engine reports.
 */
export class TrafficSignalMachine {
  private mode: SignalMode = 'auto';
  private manualTimers: ManualTimers = {
    greenMs: 30000,
    yellowMs: 3000,
    redMs: 20000,
    pedWalkMs: 15000,
  };
  private lastDetectionId: string | null = null;
  private lastAdminUserId: string | null = null;
  private unsubscribeTransition: (() => void) | null = null;

  constructor(
    private readonly yoloLive: TrafficSignalEngine,
    private options: SignalOptions,
    private readonly transport: ArduinoTransportEnum,
    private readonly recordEvent: (log: TransitionLog) => Promise<SignalEvent | null> = async () => null,
  ) {
    // Every phase change (automatic cycles, forced phases, manual cycles) is
    // persisted and audited here, so the Audit Logs page covers all of them.
    this.unsubscribeTransition = yoloLive.onTransition((transition) => this.handleTransition(transition));
  }

  /** Derived from the live engine's current phase. */
  getStatus(): { state: SignalStateEnum; since: Date } {
    const { phase, since } = this.yoloLive.getTrafficPhase();
    return { state: stateFromPhase(phase), since };
  }

  getOptions(): SignalOptions {
    return { ...this.options };
  }

  getMode(): SignalMode {
    return this.mode;
  }

  getManualTimers(): ManualTimers {
    return { ...this.manualTimers };
  }

  async setMode(mode: SignalMode): Promise<void> {
    this.mode = mode;
    await this.persistConfig();
    // Manual mode keeps the live detections reporting, but phases become
    // admin-driven only (the engine finishes any cycle already under way).
    this.yoloLive.setAutoCycleEnabled(mode === 'auto');
    this.broadcastModeChange();
    // Keep the mode in the live system state (system:state, /api/system/status) in sync.
    this.yoloLive.refreshSignalState();
  }

  async setManualTimers(timers: Partial<ManualTimers>): Promise<void> {
    this.manualTimers = { ...this.manualTimers, ...timers };
    await this.persistConfig();
    this.broadcastManualTimersChange();
    // Keep the manual timers in the live system state in sync as well.
    this.yoloLive.refreshSignalState();
    // Manual timers only drive manual test cycles and forced phases; the
    // automatic cycle's red time comes solely from signal_config.redMs
    // (see updateOptions), so nothing is copied into the engine here.
  }

  private async persistConfig(): Promise<void> {
    const data: SignalConfigData = {
      detectionThresholdMs: this.options.detectionThresholdMs,
      yellowMs: this.options.yellowMs,
      redMs: this.options.redMs,
      mode: this.mode,
      manualGreenMs: this.manualTimers.greenMs,
      manualYellowMs: this.manualTimers.yellowMs,
      manualRedMs: this.manualTimers.redMs,
      manualPedWalkMs: this.manualTimers.pedWalkMs,
    };
    await upsertConfig(data);
  }

  private getYellowDuration(): number {
    return this.mode === 'manual' ? this.manualTimers.yellowMs : this.options.yellowMs;
  }

  private getRedDuration(): number {
    return this.mode === 'manual' ? this.manualTimers.redMs : this.options.redMs;
  }

  onDetection(event: DetectionCompletedEvent): void {
    if (this.mode === 'manual') return; // Ignore detections in manual mode
    this.lastDetectionId = event.detectionId;
    // Uploaded-video detections reuse the live engine (YELLOW -> RED -> GREEN)
    // in auto mode; during an already running cycle they change nothing.
    if (event.pedestrianDetected && !this.yoloLive.isCycleActive()) {
      this.yoloLive.runManualCycle(
        { yellowMs: this.getYellowDuration(), redMs: this.getRedDuration() },
        'auto',
      );
    }
  }

  /** Admin manual override — clears any running cycle. */
  async forceState(state: SignalStateEnum, userId?: string): Promise<void> {
    this.lastAdminUserId = userId ?? null;
    this.yoloLive.forcePhase(state, { triggeredBy: TriggeredByEnum.ADMIN });
    // The forced transition fired synchronously with its own user snapshot.
    this.lastAdminUserId = null;
  }

  /** Force state with optional custom duration (manual mode only). */
  async forceStateWithDuration(state: SignalStateEnum, durationMs?: number, userId?: string): Promise<void> {
    this.lastAdminUserId = userId ?? null;
    this.yoloLive.forcePhase(state, { durationMs, triggeredBy: TriggeredByEnum.ADMIN });
    this.lastAdminUserId = null;
  }

  /** Run a full automated manual cycle: Yellow (yellowMs) -> Red (redMs) -> Green */
  async triggerManualCycle(userId?: string): Promise<void> {
    // Every leg of the cycle is attributed to the admin until the final GREEN
    // transition is recorded (see handleTransition).
    this.lastAdminUserId = userId ?? null;
    this.yoloLive.runManualCycle(
      { yellowMs: this.manualTimers.yellowMs, redMs: this.manualTimers.redMs },
      'admin',
    );
  }

  private handleTransition(transition: SignalTransition): void {
    // Snapshot synchronously: forced and manual transitions fire inside the
    // admin request while lastAdminUserId is still set. DB writes below are
    // never awaited inside the light's timing path.
    const userId = this.lastAdminUserId;
    // A manual cycle ends when the phase returns to GREEN with no timers left.
    if (
      userId !== null &&
      transition.phase === 'GREEN' &&
      transition.triggeredBy === 'admin' &&
      !this.yoloLive.isCycleActive()
    ) {
      this.lastAdminUserId = null;
    }
    void this.recordTransition(transition, userId);
  }

  private async recordTransition(transition: SignalTransition, userId: string | null): Promise<void> {
    const state = stateFromPhase(transition.phase);
    const triggeredBy = triggeredByFrom(transition.triggeredBy);

    let savedSignalEvent: SignalEvent | null = null;
    try {
      savedSignalEvent = await this.recordEvent({ state, triggeredBy, detectionId: this.lastDetectionId });
    } catch (err) {
      logger.error({ err }, 'Failed to record signal event');
    }

    // Log Arduino activation audit
    if (savedSignalEvent) {
      try {
        await logArduinoActivation({
          signalEventId: savedSignalEvent.id,
          state,
          triggeredBy,
          detectionId: this.lastDetectionId,
          transport: this.transport,
          userId,
        });
      } catch (err) {
        logger.error({ err }, 'Failed to log Arduino activation audit');
      }
    }

    // Broadcast real‑time update
    getSignalIo()?.emit('signal:update', {
      state,
      pedState: transition.pedState,
      carTimer: transition.carTimer,
      pedTimer: transition.pedTimer,
      triggeredBy,
      timestamp: new Date().toISOString(),
    });
  }

  async close(): Promise<void> {
    if (this.unsubscribeTransition) {
      this.unsubscribeTransition();
      this.unsubscribeTransition = null;
    }
  }

  /**
   * Update the automatic-cycle timings (e.g. from admin); persists them to
   * signal_config (the mode and manual-timer columns keep their values) and
   * applies them to the engine at once. New values take effect from the next
   * cycle; a cycle already running keeps its timing.
   */
  async updateOptions(newOpts: Partial<SignalOptions>): Promise<void> {
    // Skip undefined keys so a missing value (e.g. a saved row from before the
    // detection column existed) keeps the current default instead of erasing it.
    const defined = Object.fromEntries(Object.entries(newOpts).filter(([, value]) => value !== undefined));
    this.options = { ...this.options, ...defined };
    await upsertConfig({
      detectionThresholdMs: this.options.detectionThresholdMs,
      yellowMs: this.options.yellowMs,
      redMs: this.options.redMs,
    });
    this.yoloLive.setDurations({
      detectionThresholdMs: this.options.detectionThresholdMs,
      yellowDurationMs: this.options.yellowMs,
      stopDurationMs: this.options.redMs,
    });
  }

  private broadcastModeChange(): void {
    getSignalIo()?.emit('signal:mode', { mode: this.mode });
  }

  private broadcastManualTimersChange(): void {
    getSignalIo()?.emit('signal:manualTimers', this.manualTimers);
  }
}

// Load the env values as defaults; the saved timings (signal_config) are
// applied over them via initTrafficSignal().
let initialOptions: SignalOptions = {
  detectionThresholdMs: config.yoloLive.detectionThresholdMs,
  yellowMs: config.yoloLive.yellowDurationMs,
  redMs: config.yoloLive.stopDurationMs,
};

export const trafficSignal = new TrafficSignalMachine(
  liveEngine,
  initialOptions,
  auditTransport(config.yoloLive.arduinoTransport),
  async (log) => {
    return createSignalEvent({
      state: log.state,
      triggeredBy: log.triggeredBy,
      detectionId: log.detectionId,
    });
  },
);

// Share the operating mode and manual timers with the live system state that
// yoloLive broadcasts (system:state) and /api/system/status returns.
liveEngine.setSignalStateProvider(() => ({
  mode: trafficSignal.getMode(),
  manualTimers: trafficSignal.getManualTimers(),
}));

// Serial commands are sent lazily on the first state change; the sketch pins are fixed in firmware.
export async function initTrafficSignal(): Promise<void> {
  const dbConfig = await getConfig();
  if (dbConfig) {
    // Apply mode (also stops automatic cycles when the persisted mode is manual)
    if (dbConfig.mode) {
      trafficSignal.setMode(dbConfig.mode);
    }
    // Apply manual timers
    if (dbConfig.manualGreenMs !== undefined || dbConfig.manualYellowMs !== undefined ||
        dbConfig.manualRedMs !== undefined || dbConfig.manualPedWalkMs !== undefined) {
      await trafficSignal.setManualTimers({
        greenMs: dbConfig.manualGreenMs ?? 30000,
        yellowMs: dbConfig.manualYellowMs ?? 3000,
        redMs: dbConfig.manualRedMs ?? 20000,
        pedWalkMs: dbConfig.manualPedWalkMs ?? 15000,
      });
    }
    // Apply auto timings; updateOptions persists them and applies them to the
    // live engine, so the saved timings survive a restart.
    await trafficSignal.updateOptions({
      detectionThresholdMs: dbConfig.detectionThresholdMs ?? undefined,
      yellowMs: dbConfig.yellowMs,
      redMs: dbConfig.redMs,
    });
  }
}

appEvents.on(DETECTION_COMPLETED, (event: DetectionCompletedEvent) => {
  trafficSignal.onDetection(event);
});
