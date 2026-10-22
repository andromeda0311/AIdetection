import { Server as SocketIOServer } from 'socket.io';
import type { Socket } from 'socket.io';
import { isYoloEnabled } from './yoloEnabled.js';
import { logger } from '../utils/logger.js';
import type { SignalStateEnum, TriggeredByEnum } from '../entities/SignalEvent.js';

export interface YoloDetectionPayload {
  timestamp: number;
  detected: boolean;
  count: number;
  frameWidth?: number;
  frameHeight?: number;
  detections: Array<{
    class: string;
    confidence: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>;
  fusionMode?: string;
  degraded?: boolean;
  cameras?: YoloCameraPayloadView[];
}

export interface YoloCameraPayloadView {
  index: number;
  online: boolean;
  detected: boolean;
  count: number;
  detections: Array<{
    class: string;
    confidence: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>;
  frameWidth?: number;
  frameHeight?: number;
}

export interface LiveDetectionBox {
  className: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CameraLiveView {
  index: number;
  online: boolean;
  detected: boolean;
  count: number;
  confidence: number;
  detections: LiveDetectionBox[];
  frameWidth: number;
  frameHeight: number;
}

/** Operating mode of the traffic-signal engine. */
export type SignalOperatingMode = 'auto' | 'manual';

/** Signal timer settings configured by the administrator (phase durations). */
export interface ManualTimersState {
  greenMs: number;
  yellowMs: number;
  redMs: number;
  pedWalkMs: number;
}

/** Operating mode and timer settings the signal machine exposes for the live state. */
export interface SignalRuntimeState {
  mode: SignalOperatingMode;
  manualTimers: ManualTimersState;
}

export type SignalRuntimeStateProvider = () => SignalRuntimeState | null;

export interface SystemState {
  yolo: 'online' | 'offline';
  camera: 'online' | 'offline';
  arduino: 'online' | 'offline';
  traffic: 'normal' | 'caution' | 'stopped';
  pedestrianDetected: boolean;
  pedestrianCount: number;
  confidence: number;
  detectionDuration: number;
  cycleActive: boolean;
  cyclePhase: 'IDLE' | 'THRESHOLD' | 'CAUTION' | 'STOPPED';
  cycleRemainingSec: number;
  thresholdRequiredSec: number;
  autoStopSec: number;
  pedState: 'WALK' | 'DONT_WALK';
  carTimer: number | null;
  pedTimer: number | null;
  mode: SignalOperatingMode;
  manualTimers: ManualTimersState | null;
  detections: LiveDetectionBox[];
  frameWidth: number;
  frameHeight: number;
  cameras: CameraLiveView[];
  fusionMode: string;
  degraded: boolean;
  updatedAt: number;
}

export interface DurationOptions {
  detectionThresholdMs?: number;
  yellowDurationMs?: number;
  stopDurationMs?: number;
}

/**
 * Traffic-light phase. Carries the same values as SignalStateEnum ('GREEN' /
 * 'YELLOW' / 'RED'); the signal machine maps it onto the enum when recording
 * events, so the live engine needs no runtime import for it.
 */
export type SignalPhase = 'GREEN' | 'YELLOW' | 'RED';

/** Who changed the phase: 'auto' = automatic cycle, 'admin' = admin command. Same values as TriggeredByEnum. */
export type SignalTransitionTrigger = 'auto' | 'admin';

/** A phase change the engine reports on every transition (see onTransition). */
export interface SignalTransition {
  phase: SignalPhase;
  triggeredBy: SignalTransitionTrigger;
  carTimer: number | null;
  pedTimer: number | null;
  pedState: 'WALK' | 'DONT_WALK';
}

export interface ManualCycleTimers {
  yellowMs: number;
  redMs: number;
}

export interface ForcePhaseOptions {
  /** When set, the phase runs with a countdown and returns to GREEN afterwards; otherwise it is held. */
  durationMs?: number;
  triggeredBy: SignalTransitionTrigger;
}

/**
 * The parts of the live engine the signal machine uses. YoloLiveService is the
 * single source of truth for the light; trafficSignal requests changes on it
 * and records the audit trail from the transitions the engine reports.
 */
export interface TrafficSignalEngine {
  setAutoCycleEnabled(enabled: boolean): void;
  forcePhase(phase: SignalPhase, options: ForcePhaseOptions): void;
  runManualCycle(timers: ManualCycleTimers, triggeredBy: SignalTransitionTrigger): void;
  getTrafficPhase(): { phase: SignalPhase; since: Date };
  isCycleActive(): boolean;
  refreshSignalState(): void;
  setDurations(options: DurationOptions): void;
  onTransition(listener: (transition: SignalTransition) => void): () => void;
}

export type ArduinoCommand =
  | 'CAUTION_TRAFFIC'
  | 'STOP_TRAFFIC'
  | 'NORMAL_TRAFFIC'
  | 'PING'
  | 'COUNTDOWN:CARS'
  | 'COUNTDOWN:PEDS';

export interface ArduinoCommandSender {
  send(command: ArduinoCommand): void;
  getStatus(): 'online' | 'offline';
}

export interface SystemStateBroadcaster {
  broadcast(state: SystemState): void;
}

function normalizeDetections(
  detections: YoloDetectionPayload['detections'],
): LiveDetectionBox[] {
  return detections.map((detection) => ({
    className: detection.class,
    confidence: detection.confidence,
    x1: detection.x1,
    y1: detection.y1,
    x2: detection.x2,
    y2: detection.y2,
  }));
}

function normalizeCameraViews(payload: YoloDetectionPayload): CameraLiveView[] {
  if (!payload.cameras?.length) return [];
  return payload.cameras.map((camera) => ({
    index: camera.index,
    online: camera.online,
    detected: camera.detected,
    count: camera.count,
    confidence: camera.detections[0]?.confidence ?? 0,
    detections: normalizeDetections(camera.detections),
    frameWidth: camera.frameWidth ?? 0,
    frameHeight: camera.frameHeight ?? 0,
  }));
}

function cameraSignature(cameras: CameraLiveView[]): string {
  return cameras
    .map((camera) => {
      const boxes = camera.detections
        .map((box) => `${box.className}:${box.confidence}:${box.x1}:${box.y1}:${box.x2}:${box.y2}`)
        .join(',');
      return `${camera.index}:${camera.online ? 1 : 0}:${camera.detected ? 1 : 0}:${camera.count}:${camera.confidence.toFixed(2)}:${boxes}`;
    })
    .join('|');
}

function broadcastSignature(state: SystemState): string {
  const boxes = state.detections
    .map((box) => `${box.className}:${box.confidence}:${box.x1}:${box.y1}:${box.x2}:${box.y2}`)
    .join('|');
  return [
    state.yolo,
    state.camera,
    state.arduino,
    state.pedestrianDetected,
    state.pedestrianCount,
    state.confidence,
    state.detectionDuration.toFixed(1),
    state.traffic,
    state.cycleActive,
    state.cyclePhase,
    state.cycleRemainingSec,
    state.autoStopSec,
    state.pedState,
    state.carTimer,
    state.pedTimer,
    state.mode,
    state.manualTimers
      ? `${state.manualTimers.greenMs}/${state.manualTimers.yellowMs}/${state.manualTimers.redMs}/${state.manualTimers.pedWalkMs}`
      : '-',
    boxes,
    cameraSignature(state.cameras),
    state.fusionMode,
    state.degraded ? 1 : 0,
  ].join(':');
}

export class YoloLiveService {
  readonly systemState: SystemState = {
    yolo: 'offline',
    camera: 'offline',
    arduino: 'offline',
    traffic: 'normal',
    pedestrianDetected: false,
    pedestrianCount: 0,
    confidence: 0,
    detectionDuration: 0,
    cycleActive: false,
    cyclePhase: 'IDLE',
    cycleRemainingSec: 0,
    thresholdRequiredSec: 5,
    autoStopSec: 0,
    pedState: 'DONT_WALK',
    carTimer: null,
    pedTimer: null,
    mode: 'auto',
    manualTimers: null,
    detections: [],
    frameWidth: 0,
    frameHeight: 0,
    cameras: [],
    fusionMode: 'OR_FALLBACK',
    degraded: false,
    updatedAt: 0,
  };

  private detectionStartedAt: number | null = null;
  private trafficCycleActive = false;
  private autoCycleEnabled = true;
  private currentPhase: SignalPhase = 'GREEN';
  private currentPhaseSince: Date = new Date();
  private transitionListeners = new Set<(transition: SignalTransition) => void>();
  private signalStateProvider: SignalRuntimeStateProvider | null = null;
  private yellowTimer: NodeJS.Timeout | null = null;
  private stopTimer: NodeJS.Timeout | null = null;
  private countdownInterval: NodeJS.Timeout | null = null;
  private countdownRemaining = 0;
  private lastDetectionAt = 0;
  private lastBroadcastAt = 0;
  private lastBroadcastSignature = '';

  constructor(
    private readonly arduino: ArduinoCommandSender,
    private readonly broadcaster: SystemStateBroadcaster,
    private detectionThresholdMs: number,
    private yellowDurationMs: number,
    private stopDurationMs: number,
    private readonly broadcastIntervalMs = 500,
  ) {
    this.systemState.thresholdRequiredSec = this.detectionThresholdMs / 1000;
    this.systemState.autoStopSec = Math.round(this.stopDurationMs / 1000);
  }

  /** Update cycle durations at runtime (applies from the next pedestrian cycle). */
  setDurations(options: DurationOptions): void {
    if (options.detectionThresholdMs !== undefined) {
      this.detectionThresholdMs = Math.max(500, options.detectionThresholdMs);
    }
    if (options.yellowDurationMs !== undefined) {
      this.yellowDurationMs = Math.max(500, options.yellowDurationMs);
    }
    if (options.stopDurationMs !== undefined) {
      this.stopDurationMs = Math.max(500, options.stopDurationMs);
    }
    this.systemState.thresholdRequiredSec = this.detectionThresholdMs / 1000;
    this.systemState.autoStopSec = Math.round(this.stopDurationMs / 1000);
    this.maybeBroadcast(Date.now(), false);
  }

  handleDetection(payload: YoloDetectionPayload): void {
    const now = Date.now();
    // Read live so the admin enable/disable toggle applies without a restart.
    const yoloEnabled = isYoloEnabled();
    this.lastDetectionAt = now;
    this.systemState.yolo = yoloEnabled ? 'online' : 'offline';
    this.systemState.camera = yoloEnabled ? 'online' : 'offline';
    this.systemState.arduino = this.arduino.getStatus();
    this.systemState.pedestrianDetected = payload.detected;
    this.systemState.pedestrianCount = payload.count;
    this.systemState.confidence = payload.detections[0]?.confidence ?? 0;
    this.systemState.detections = normalizeDetections(payload.detections);
    this.systemState.frameWidth = payload.frameWidth ?? 0;
    this.systemState.frameHeight = payload.frameHeight ?? 0;
    this.systemState.cameras = normalizeCameraViews(payload);
    if (payload.fusionMode !== undefined) {
      this.systemState.fusionMode = payload.fusionMode;
    }
    this.systemState.degraded = payload.degraded ?? false;
    this.systemState.updatedAt = payload.timestamp || now;
    this.systemState.thresholdRequiredSec = this.detectionThresholdMs / 1000;

    if (payload.detected && yoloEnabled) {
      if (this.detectionStartedAt === null) {
        this.detectionStartedAt = now;
      }
      this.systemState.detectionDuration = (now - this.detectionStartedAt) / 1000;

      // In manual mode counts keep updating, but the light is only changed by
      // admin commands; a cycle already running when manual began finishes.
      if (this.autoCycleEnabled && !this.trafficCycleActive) {
        this.systemState.cyclePhase = 'THRESHOLD';
        if (this.systemState.detectionDuration >= this.detectionThresholdMs / 1000) {
          this.runSignalSequence(this.yellowDurationMs, this.stopDurationMs, 'auto');
        }
      }
    } else {
      this.detectionStartedAt = null;
      this.systemState.detectionDuration = 0;
      if (!this.trafficCycleActive) {
        this.systemState.cyclePhase = 'IDLE';
      }
    }

    this.maybeBroadcast(now, false);
  }

  markYoloOffline(): void {
    if (!isYoloEnabled()) return;
    const staleMs = 5000;
    if (Date.now() - this.lastDetectionAt > staleMs) {
      if (this.systemState.yolo === 'offline' && this.detectionStartedAt === null) return;
      this.systemState.yolo = 'offline';
      this.systemState.camera = 'offline';
      // Old detections must not count towards the threshold or start a cycle.
      // A cycle that is already running finishes on its own timers.
      this.detectionStartedAt = null;
      this.systemState.pedestrianDetected = false;
      this.systemState.pedestrianCount = 0;
      this.systemState.confidence = 0;
      this.systemState.detectionDuration = 0;
      if (!this.trafficCycleActive) this.systemState.cyclePhase = 'IDLE';
      this.systemState.detections = [];
      this.systemState.frameWidth = 0;
      this.systemState.frameHeight = 0;
      this.systemState.cameras = this.systemState.cameras.map((camera) => ({
        ...camera,
        online: false,
        detected: false,
        count: 0,
        confidence: 0,
        detections: [],
        frameWidth: 0,
        frameHeight: 0,
      }));
      this.maybeBroadcast(Date.now(), false);
    }
  }

  /** Register where the operating mode and manual timer settings come from (the signal machine). */
  setSignalStateProvider(provider: SignalRuntimeStateProvider | null): void {
    this.signalStateProvider = provider;
    this.refreshSignalState();
  }

  /**
   * Manual mode: live detections keep updating counts, boxes and camera state,
   * but never start a pedestrian cycle. A cycle already running when manual
   * mode begins finishes normally; no new one starts. Switching back to auto
   * requires a fresh continuous detection before a cycle may start again.
   */
  setAutoCycleEnabled(enabled: boolean): void {
    if (this.autoCycleEnabled === enabled) return;
    this.autoCycleEnabled = enabled;
    if (enabled) {
      // Stale detection progress from the manual period must not count
      // towards the threshold; the next cycle needs a fresh one.
      this.detectionStartedAt = null;
      this.systemState.detectionDuration = 0;
      if (!this.trafficCycleActive) {
        this.systemState.cyclePhase = 'IDLE';
        this.systemState.cycleRemainingSec = 0;
      }
    }
    this.maybeBroadcast(Date.now(), false);
  }

  /**
   * Admin override: cancels any running cycle or timer and sets the phase
   * immediately. With durationMs the phase shows a countdown and returns to
   * GREEN when it ends; without it the phase is held until another command.
   * Broadcasts happen immediately (they bypass the throttle).
   */
  forcePhase(phase: SignalPhase, options: ForcePhaseOptions): void {
    const triggeredBy = options.triggeredBy;
    const durationMs = options.durationMs;
    this.clearCycleTimers();
    this.trafficCycleActive = false;

    switch (phase) {
      case 'GREEN': {
        this.systemState.cycleActive = false;
        this.systemState.cyclePhase = 'IDLE';
        this.systemState.cycleRemainingSec = 0;
        this.setPhase('GREEN', { triggeredBy });
        this.clearCountdown();
        this.arduino.send('NORMAL_TRAFFIC');
        break;
      }
      case 'YELLOW': {
        if (durationMs) {
          const yellowSec = Math.ceil(durationMs / 1000);
          this.systemState.cycleActive = true;
          this.systemState.cyclePhase = 'CAUTION';
          this.systemState.cycleRemainingSec = yellowSec;
          this.arduino.send('CAUTION_TRAFFIC');
          this.setPhase('YELLOW', { triggeredBy, carTimer: yellowSec });
          this.startCountdownForDuration(yellowSec);
          this.yellowTimer = setTimeout(() => {
            this.yellowTimer = null;
            this.beginRedLeg(this.stopDurationMs, triggeredBy);
          }, durationMs);
        } else {
          this.systemState.cycleActive = false;
          this.systemState.cyclePhase = 'CAUTION';
          this.systemState.cycleRemainingSec = 0;
          this.arduino.send('CAUTION_TRAFFIC');
          this.setPhase('YELLOW', { triggeredBy });
        }
        break;
      }
      case 'RED': {
        if (durationMs) {
          const stopSec = Math.floor(durationMs / 1000);
          this.systemState.cycleActive = true;
          this.systemState.cyclePhase = 'STOPPED';
          this.systemState.cycleRemainingSec = stopSec;
          this.arduino.send('STOP_TRAFFIC');
          this.setPhase('RED', { triggeredBy, carTimer: stopSec, pedTimer: stopSec });
          this.startCountdownForDuration(stopSec);
          this.stopTimer = setTimeout(() => {
            this.stopTimer = null;
            this.endCycleToGreen(triggeredBy);
          }, durationMs);
        } else {
          this.systemState.cycleActive = false;
          this.systemState.cyclePhase = 'STOPPED';
          this.systemState.cycleRemainingSec = 0;
          this.arduino.send('STOP_TRAFFIC');
          this.setPhase('RED', { triggeredBy });
        }
        break;
      }
    }

    this.maybeBroadcast(Date.now(), false);
  }

  /**
   * Run a full signal phase sequence on demand (admin test cycle): YELLOW -> RED
   * -> GREEN using the given durations, with countdowns, like the automatic cycle.
   */
  runManualCycle(timers: ManualCycleTimers, triggeredBy: SignalTransitionTrigger): void {
    this.runSignalSequence(timers.yellowMs, timers.redMs, triggeredBy);
  }

  /** The current phase (SignalStateEnum values) and when it was entered. */
  getTrafficPhase(): { phase: SignalPhase; since: Date } {
    return { phase: this.currentPhase, since: this.currentPhaseSince };
  }

  /** Whether a signal sequence (cycle or timed forced phase) is currently running. */
  isCycleActive(): boolean {
    return this.trafficCycleActive;
  }

  /** Subscribe to every phase change; the signal machine records events and audit rows from it. */
  onTransition(listener: (transition: SignalTransition) => void): () => void {
    this.transitionListeners.add(listener);
    return () => this.transitionListeners.delete(listener);
  }

  /** Re-read the YOLO enable toggle (no restart needed) and broadcast the change immediately. */
  refreshYoloEnabled(): void {
    if (!isYoloEnabled()) {
      // Stale positive detections must not survive the disable.
      this.systemState.yolo = 'offline';
      this.systemState.camera = 'offline';
      this.detectionStartedAt = null;
      this.systemState.detectionDuration = 0;
      this.systemState.pedestrianDetected = false;
      this.systemState.pedestrianCount = 0;
      this.systemState.confidence = 0;
      this.systemState.detections = [];
      this.systemState.frameWidth = 0;
      this.systemState.frameHeight = 0;
      if (!this.trafficCycleActive) this.systemState.cyclePhase = 'IDLE';
    }
    this.maybeBroadcast(Date.now(), false);
  }

  /** YELLOW -> RED -> GREEN with countdowns; shared by the automatic and manual cycles. */
  private runSignalSequence(yellowMs: number, redMs: number, triggeredBy: SignalTransitionTrigger): void {
    this.clearCycleTimers();
    this.trafficCycleActive = true;
    this.systemState.cycleActive = true;
    const yellowSec = Math.ceil(yellowMs / 1000);
    this.systemState.cyclePhase = 'CAUTION';
    this.systemState.cycleRemainingSec = yellowSec;
    this.arduino.send('CAUTION_TRAFFIC');
    this.setPhase('YELLOW', { triggeredBy, carTimer: yellowSec });
    this.startCountdownForDuration(yellowSec);

    this.yellowTimer = setTimeout(() => {
      this.yellowTimer = null;
      this.beginRedLeg(redMs, triggeredBy);
    }, yellowMs);
  }

  /** RED stop leg of a sequence: countdown for the stop duration, then back to GREEN. */
  private beginRedLeg(redMs: number, triggeredBy: SignalTransitionTrigger): void {
    const stopSec = Math.floor(redMs / 1000);
    this.systemState.cyclePhase = 'STOPPED';
    this.systemState.cycleRemainingSec = stopSec;
    this.arduino.send('STOP_TRAFFIC');
    this.setPhase('RED', { triggeredBy, carTimer: stopSec, pedTimer: stopSec });
    this.startCountdownForDuration(stopSec);

    this.stopTimer = setTimeout(() => {
      this.stopTimer = null;
      this.endCycleToGreen(triggeredBy);
    }, redMs);
  }

  private endCycleToGreen(triggeredBy: SignalTransitionTrigger): void {
    this.trafficCycleActive = false;
    this.systemState.cycleActive = false;
    this.systemState.cyclePhase = 'IDLE';
    this.systemState.cycleRemainingSec = 0;
    this.setPhase('GREEN', { triggeredBy });
    this.clearCountdown();
    this.arduino.send('NORMAL_TRAFFIC');
  }

  /**
   * Change the phase, notify the transition listeners and broadcast immediately.
   * Silently skips when the light is already in the requested phase.
   */
  private setPhase(
    phase: SignalPhase,
    options: { triggeredBy: SignalTransitionTrigger; carTimer?: number | null; pedTimer?: number | null },
  ): void {
    if (phase === this.currentPhase) return;
    this.currentPhase = phase;
    this.currentPhaseSince = new Date();
    this.systemState.traffic = phase === 'GREEN' ? 'normal' : phase === 'YELLOW' ? 'caution' : 'stopped';
    // While the car light is red the pedestrians may cross; any other phase means they wait.
    this.systemState.pedState = phase === 'RED' ? 'WALK' : 'DONT_WALK';
    const transition: SignalTransition = {
      phase,
      triggeredBy: options.triggeredBy,
      carTimer: options.carTimer ?? null,
      pedTimer: options.pedTimer ?? null,
      pedState: this.systemState.pedState,
    };
    for (const listener of this.transitionListeners) {
      try {
        listener(transition);
      } catch (err) {
        logger.error({ err }, 'Signal transition listener failed');
      }
    }
    this.maybeBroadcast(Date.now(), false);
  }

  private clearCycleTimers(): void {
    if (this.yellowTimer) clearTimeout(this.yellowTimer);
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.yellowTimer = null;
    this.stopTimer = null;
    this.clearCountdown();
  }

  private startCountdownForDuration(durationSec: number): void {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownRemaining = durationSec;
    this.systemState.cycleRemainingSec = this.countdownRemaining;
    this.sendCountdown();

    this.countdownInterval = setInterval(() => {
      this.countdownRemaining--;
      this.systemState.cycleRemainingSec = Math.max(0, this.countdownRemaining);
      this.maybeBroadcast(Date.now(), false);

      if (this.countdownRemaining <= 0) {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.countdownInterval = null;
        return;
      }
      this.sendCountdown();
    }, 1000);
  }

  private sendCountdown(): void {
    const sec = Math.max(0, Math.min(99, this.countdownRemaining));
    const padded = sec.toString().padStart(2, '0');
    this.arduino.send(`COUNTDOWN:CARS:${padded}` as ArduinoCommand);
    this.arduino.send(`COUNTDOWN:PEDS:${padded}` as ArduinoCommand);
  }

  private clearCountdown(): void {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownInterval = null;
    this.countdownRemaining = 0;
    this.arduino.send('COUNTDOWN:CARS:00' as ArduinoCommand);
    this.arduino.send('COUNTDOWN:PEDS:00' as ArduinoCommand);
  }

  /** Re-read mode/manualTimers from the provider and broadcast — used when the signal machine changes them. */
  refreshSignalState(): void {
    this.maybeBroadcast(Date.now(), false);
  }

  /** Derive pedestrian-signal fields from the running cycle and the signal machine's mode. */
  private updateSignalStateFields(): void {
    const runtime = this.signalStateProvider?.() ?? null;
    this.systemState.mode = runtime?.mode ?? 'auto';
    this.systemState.manualTimers = runtime?.manualTimers ?? null;
    // While the car light is red the pedestrians may cross; any other phase means they wait.
    this.systemState.pedState = this.systemState.traffic === 'stopped' ? 'WALK' : 'DONT_WALK';
    // During a running phase both countdowns show the seconds remaining of that phase.
    const remaining = this.systemState.cycleActive
      ? Math.max(0, Math.floor(this.systemState.cycleRemainingSec))
      : null;
    this.systemState.carTimer = remaining;
    this.systemState.pedTimer = remaining;
  }

  private maybeBroadcast(now: number, respectThrottle: boolean): void {
    this.updateSignalStateFields();
    const signature = broadcastSignature(this.systemState);
    const signatureChanged = signature !== this.lastBroadcastSignature;
    const intervalElapsed = now - this.lastBroadcastAt >= this.broadcastIntervalMs;

    if (!respectThrottle || signatureChanged || intervalElapsed) {
      this.broadcaster.broadcast({ ...this.systemState });
      this.lastBroadcastAt = now;
      this.lastBroadcastSignature = signature;
    }
  }

  getSystemState(): SystemState {
    this.systemState.arduino = this.arduino.getStatus();
    this.updateSignalStateFields();
    return {
      ...this.systemState,
      detections: [...this.systemState.detections],
      cameras: this.systemState.cameras.map((camera) => ({
        ...camera,
        detections: [...camera.detections],
      })),
    };
  }

  close(): void {
    this.clearCycleTimers();
    if (this.countdownInterval) clearInterval(this.countdownInterval);
  }
}

export function createSocketIoBroadcaster(io: SocketIOServer, room = 'dashboard'): SystemStateBroadcaster {
  return {
    broadcast(state: SystemState): void {
      io.to(room).emit('system:state', state);
    },
  };
}
