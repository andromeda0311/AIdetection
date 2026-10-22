import config from '../config/env.js';
import { logger } from '../utils/logger.js';
import { createSignalEvent } from '../models/SignalEvent.js';
import { createSignalController, type SignalController, type PedestrianState } from './signal/controller.js';
import { appEvents, DETECTION_COMPLETED, type DetectionCompletedEvent } from './events.js';
import { getConfig, upsertConfig, type SignalConfigData } from '../models/SignalConfig.js';
import { SignalStateEnum, TriggeredByEnum } from '../entities/SignalEvent.js';
import { SignalEvent } from '../entities/SignalEvent.js';
import { logArduinoActivation } from './trafficLightAudit.service.js';
import { ArduinoTransportEnum } from '../entities/TrafficLightAuditLog.js';
import { getSignalIo, yoloLive } from './yoloLive.instance.js';

export interface SignalOptions {
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

type TrafficState = 'GREEN' | 'YELLOW' | 'RED';
type SignalMode = 'auto' | 'manual';

/**
 * Owns the traffic light state machine.
 *
 *   GREEN -> (pedestrian detected) -> YELLOW (3s) -> RED (20s) -> GREEN
 *
 * RED is extended while new detections with pedestrians keep arriving; when no
 * more pedestrians are detected it returns to GREEN after the RED period.
 */
export class TrafficSignalMachine {
  private state: SignalStateEnum = SignalStateEnum.GREEN;
  private stateSince: Date = new Date();
  private yellowTimer: NodeJS.Timeout | null = null;
  private redTimer: NodeJS.Timeout | null = null;
  private redCountdownTimer: NodeJS.Timeout | null = null;
  private lastDetectionId: string | null = null;
  private lastAdminUserId: string | null = null;
  private pedState: PedestrianState = 'DONT_WALK';
  private redRemaining: number = 0;

  // Mode and manual timers
  private mode: SignalMode = 'auto';
  private manualTimers: ManualTimers = {
    greenMs: 30000,
    yellowMs: 3000,
    redMs: 20000,
    pedWalkMs: 15000,
  };

  constructor(
    private readonly controller: SignalController,
    private options: SignalOptions,
    private readonly transport: ArduinoTransportEnum,
    private readonly recordEvent: (log: TransitionLog) => Promise<SignalEvent | null> = async () => null,
  ) {}

  getStatus(): { state: SignalStateEnum; since: Date } {
    return { state: this.state, since: this.stateSince };
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
    if (mode === 'manual') {
      this.clearTimers();
      this.clearRedCountdown();
    }
    this.broadcastModeChange();
    // Keep the mode in the live system state (system:state, /api/system/status) in sync.
    yoloLive.refreshSignalState();
  }

  async setManualTimers(timers: Partial<ManualTimers>): Promise<void> {
    this.manualTimers = { ...this.manualTimers, ...timers };
    await this.persistConfig();
    this.broadcastManualTimersChange();
    // Keep the manual timers in the live system state in sync as well.
    yoloLive.refreshSignalState();
    // Keep the auto (YOLO) cycle in sync with the configured red stop duration.
    if (timers.redMs !== undefined) {
      yoloLive.setDurations({ stopDurationMs: timers.redMs });
    }
  }

  private async persistConfig(): Promise<void> {
    const data: SignalConfigData = {
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

  private getPedWalkDuration(): number {
    return this.mode === 'manual' ? this.manualTimers.pedWalkMs : this.options.redMs;
  }

  onDetection(event: DetectionCompletedEvent): void {
    if (this.mode === 'manual') return; // Ignore YOLO detections in manual mode
    this.lastDetectionId = event.detectionId;
    if (event.pedestrianDetected) {
      this.beginPedestrianCycle();
    }
  }

  private beginPedestrianCycle(): void {
    this.clearTimers();

    if (this.state === SignalStateEnum.RED) {
      this.redRemaining = this.getRedDuration();
      this.startRedCountdown();
      this.redTimer = setTimeout(() => void this.endRed(), this.getRedDuration());
      return;
    }

    if (this.state === SignalStateEnum.YELLOW) {
      this.yellowTimer = setTimeout(() => void this.goRed(), this.getYellowDuration());
      return;
    }

    void this.transition(SignalStateEnum.YELLOW, TriggeredByEnum.AUTO);
    this.yellowTimer = setTimeout(() => void this.goRed(), this.getYellowDuration());
  }

  private async goRed(): Promise<void> {
    await this.transition(SignalStateEnum.RED, TriggeredByEnum.AUTO);
    this.redRemaining = this.getRedDuration();
    this.startRedCountdown();
    this.redTimer = setTimeout(() => void this.endRed(), this.getRedDuration());
  }

  private startRedCountdown(): void {
    this.clearRedCountdown();
    this.redCountdownTimer = setInterval(() => {
      this.redRemaining = Math.max(0, this.redRemaining - 1000);
      this.sendTimerUpdates();
      if (this.redRemaining <= 0) {
        this.clearRedCountdown();
      }
    }, 1000);
  }

  private clearRedCountdown(): void {
    if (this.redCountdownTimer) {
      clearInterval(this.redCountdownTimer);
      this.redCountdownTimer = null;
    }
  }

  private sendTimerUpdates(): void {
    // Always send car timer (seconds remaining) to Arduino for display. Convert milliseconds to seconds.
    const carTimer = this.redRemaining > 0 ? Math.ceil(this.redRemaining / 1000) : null;
    const pedTimer = this.state === SignalStateEnum.RED ? Math.ceil(this.redRemaining / 1000) : null;
    this.controller.send(this.state as TrafficState, this.pedState, carTimer, pedTimer).catch((err) => {
      logger.error({ err }, 'Failed to send timer update');
    });
  }

  private async endRed(): Promise<void> {
    this.clearRedCountdown();
    await this.transition(SignalStateEnum.GREEN, TriggeredByEnum.AUTO);
  }

  /** Admin manual override — clears any running cycle. */
  async forceState(state: SignalStateEnum, userId?: string): Promise<void> {
    this.lastAdminUserId = userId ?? null;
    this.clearTimers();
    this.clearRedCountdown();
    await this.transition(state, TriggeredByEnum.ADMIN);
    this.lastAdminUserId = null;
  }

  /** Run a full automated manual cycle: Green (greenMs) -> Yellow (yellowMs) -> Red (redMs) -> Green */
  async triggerManualCycle(userId?: string): Promise<void> {
    this.lastAdminUserId = userId ?? null;
    this.clearTimers();
    this.clearRedCountdown();

    const greenMs = this.manualTimers.greenMs;
    const yellowMs = this.manualTimers.yellowMs;
    const redMs = this.manualTimers.redMs;

    const greenSec = Math.ceil(greenMs / 1000);
    const yellowSec = Math.ceil(yellowMs / 1000);
    const redSec = Math.ceil(redMs / 1000);

    // Step 1: GREEN
    await this.transition(SignalStateEnum.GREEN, TriggeredByEnum.ADMIN);
    this.startManualPhaseCountdown(greenSec, 'GREEN');

    this.yellowTimer = setTimeout(async () => {
      // Step 2: YELLOW
      await this.transition(SignalStateEnum.YELLOW, TriggeredByEnum.ADMIN);
      this.startManualPhaseCountdown(yellowSec, 'YELLOW');

      this.redTimer = setTimeout(async () => {
        // Step 3: RED
        await this.transition(SignalStateEnum.RED, TriggeredByEnum.ADMIN);
        this.startManualPhaseCountdown(redSec, 'RED');

        setTimeout(async () => {
          // Return to GREEN on complete
          await this.transition(SignalStateEnum.GREEN, TriggeredByEnum.ADMIN);
          this.clearRedCountdown();
          this.lastAdminUserId = null;
        }, redMs);

      }, yellowMs);

    }, greenMs);
  }

  private startManualPhaseCountdown(seconds: number, _phase: 'GREEN' | 'YELLOW' | 'RED'): void {
    this.clearRedCountdown();
    this.redRemaining = seconds * 1000;
    this.sendTimerUpdates();

    this.redCountdownTimer = setInterval(() => {
      this.redRemaining = Math.max(0, this.redRemaining - 1000);
      this.sendTimerUpdates();
      if (this.redRemaining <= 0) {
        this.clearRedCountdown();
      }
    }, 1000);
  }

  /** Force state with optional custom duration (manual mode only). */
  async forceStateWithDuration(state: SignalStateEnum, durationMs?: number, userId?: string): Promise<void> {
    this.lastAdminUserId = userId ?? null;
    this.clearTimers();
    this.clearRedCountdown();

    // Store custom duration for this transition
    if (durationMs && state === SignalStateEnum.RED) {
      this.redRemaining = durationMs;
    } else if (durationMs && state === SignalStateEnum.YELLOW) {
      // Yellow with custom duration - will transition to RED after duration
      this.yellowTimer = setTimeout(() => void this.goRed(), durationMs);
      await this.transition(state, TriggeredByEnum.ADMIN);
      this.lastAdminUserId = null;
      return;
    }

    await this.transition(state, TriggeredByEnum.ADMIN);
    this.lastAdminUserId = null;
  }

  private async transition(state: SignalStateEnum, triggeredBy: TriggeredByEnum): Promise<void> {
    if (state === this.state) return;
    this.state = state;
    this.stateSince = new Date();

    // Determine pedestrian state based on traffic state
    this.pedState = state === SignalStateEnum.RED ? 'WALK' : 'DONT_WALK';

    // Calculate timer values for display
    let carTimer: number | null = null;
    let pedTimer: number | null = null;

    switch (state) {
      case SignalStateEnum.GREEN:
        carTimer = null;
        pedTimer = null;
        break;
      case SignalStateEnum.YELLOW:
        carTimer = Math.ceil(this.getYellowDuration() / 1000);
        pedTimer = null;
        break;
      case SignalStateEnum.RED:
        carTimer = Math.ceil(this.getRedDuration() / 1000);
        pedTimer = Math.ceil(this.getPedWalkDuration() / 1000);
        this.redRemaining = this.getRedDuration();
        break;
    }

    await this.controller.send(state as TrafficState, this.pedState, carTimer, pedTimer).catch((err) => {
      logger.error({ err }, 'Failed to send signal command');
    });

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
          userId: this.lastAdminUserId,
        });
      } catch (err) {
        logger.error({ err }, 'Failed to log Arduino activation audit');
      }
    }

    // Broadcast real‑time update
    getSignalIo()?.emit('signal:update', {
      state,
      pedState: this.pedState,
      carTimer,
      pedTimer,
      triggeredBy,
      timestamp: new Date().toISOString(),
    });
  }

  private clearTimers(): void {
    if (this.yellowTimer) clearTimeout(this.yellowTimer);
    if (this.redTimer) clearTimeout(this.redTimer);
    this.yellowTimer = null;
    this.redTimer = null;
  }

  async close(): Promise<void> {
    this.clearTimers();
    this.clearRedCountdown();
    await this.controller.close();
  }

  /** Update timing options (e.g., from admin). */
  async updateOptions(newOpts: Partial<SignalOptions>): Promise<void> {
    this.options = { ...this.options, ...newOpts };
    // Persist to DB
    await upsertConfig({ yellowMs: this.options.yellowMs, redMs: this.options.redMs });
    // If currently in a timed state, restart its timer with new duration
    this.clearTimers();
    this.clearRedCountdown();
    if (this.state === SignalStateEnum.YELLOW) {
      this.yellowTimer = setTimeout(() => void this.goRed(), this.getYellowDuration());
    } else if (this.state === SignalStateEnum.RED) {
      this.redRemaining = this.getRedDuration();
      this.startRedCountdown();
      this.redTimer = setTimeout(() => void this.endRed(), this.getRedDuration());
    }
  }

  private broadcastModeChange(): void {
    getSignalIo()?.emit('signal:mode', { mode: this.mode });
  }

  private broadcastManualTimersChange(): void {
    getSignalIo()?.emit('signal:manualTimers', this.manualTimers);
  }
}

// Load initial config from env; DB config will be applied later via initTrafficSignal()
let initialOptions: SignalOptions = { yellowMs: config.signal.yellowMs, redMs: config.signal.redMs };

export const trafficSignal = new TrafficSignalMachine(
  createSignalController(config.signal),
  initialOptions,
  config.signal.transport as ArduinoTransportEnum,
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
yoloLive.setSignalStateProvider(() => ({
  mode: trafficSignal.getMode(),
  manualTimers: trafficSignal.getManualTimers(),
}));

// Serial commands are sent lazily on the first state change; the sketch pins are fixed in firmware.
export async function initTrafficSignal(): Promise<void> {
  const dbConfig = await getConfig();
  if (dbConfig) {
    // Apply mode
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
    // Apply auto timers
    await trafficSignal.updateOptions({ yellowMs: dbConfig.yellowMs, redMs: dbConfig.redMs });
    // Keep the auto (YOLO) cycle stop duration in sync with the persisted red value.
    const persistedRedMs = dbConfig.manualRedMs ?? dbConfig.redMs;
    if (persistedRedMs !== undefined) {
      yoloLive.setDurations({ stopDurationMs: persistedRedMs });
    }
  }
}

appEvents.on(DETECTION_COMPLETED, (event: DetectionCompletedEvent) => {
  trafficSignal.onDetection(event);
});