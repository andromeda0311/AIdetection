import { Server as SocketIOServer } from 'socket.io';
import type { Socket } from 'socket.io';
import { isYoloEnabled } from './yoloEnabled.js';

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
  private signalStateProvider: SignalRuntimeStateProvider | null = null;
  private yellowTimer: NodeJS.Timeout | null = null;
  private stopTimer: NodeJS.Timeout | null = null;
  private countdownInterval: NodeJS.Timeout | null = null;
  private countdownRemaining = 0;
  private lastDetectionAt = 0;
  private lastBroadcastAt = 0;
  private lastBroadcastSignature = '';

  private readonly yoloEnabled: boolean;

  constructor(
    private readonly arduino: ArduinoCommandSender,
    private readonly broadcaster: SystemStateBroadcaster,
    private detectionThresholdMs: number,
    private yellowDurationMs: number,
    private stopDurationMs: number,
    private readonly broadcastIntervalMs = 500,
  ) {
    this.yoloEnabled = isYoloEnabled();
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
    this.lastDetectionAt = now;
    this.systemState.yolo = this.yoloEnabled ? 'online' : 'offline';
    this.systemState.camera = this.yoloEnabled ? 'online' : 'offline';
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

    if (payload.detected && this.yoloEnabled) {
      if (this.detectionStartedAt === null) {
        this.detectionStartedAt = now;
      }
      this.systemState.detectionDuration = (now - this.detectionStartedAt) / 1000;

      if (!this.trafficCycleActive) {
        this.systemState.cyclePhase = 'THRESHOLD';
      }

      if (this.systemState.detectionDuration >= this.detectionThresholdMs / 1000 && !this.trafficCycleActive) {
        this.beginPedestrianCycle();
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
    if (!this.yoloEnabled) return;
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

  private beginPedestrianCycle(): void {
    this.clearCycleTimers();
    this.trafficCycleActive = true;
    this.systemState.cycleActive = true;
    this.systemState.cyclePhase = 'CAUTION';
    this.systemState.traffic = 'caution';

    const cautionSec = Math.ceil(this.yellowDurationMs / 1000);
    this.systemState.cycleRemainingSec = cautionSec;
    this.arduino.send('CAUTION_TRAFFIC');
    this.startCountdownForDuration(cautionSec);
    this.maybeBroadcast(Date.now(), false);

    this.yellowTimer = setTimeout(() => {
      this.systemState.traffic = 'stopped';
      this.systemState.cyclePhase = 'STOPPED';
      this.arduino.send('STOP_TRAFFIC');

      const stopSec = Math.floor(this.stopDurationMs / 1000);
      this.startCountdownForDuration(stopSec);
      this.maybeBroadcast(Date.now(), false);

      this.stopTimer = setTimeout(() => {
        this.trafficCycleActive = false;
        this.systemState.cycleActive = false;
        this.systemState.cyclePhase = 'IDLE';
        this.systemState.cycleRemainingSec = 0;
        this.systemState.traffic = 'normal';
        this.clearCountdown();
        this.arduino.send('NORMAL_TRAFFIC');
        this.maybeBroadcast(Date.now(), false);
        this.stopTimer = null;
      }, this.stopDurationMs);
      this.yellowTimer = null;
    }, this.yellowDurationMs);
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

  /** Register where the operating mode and manual timer settings come from (the signal machine). */
  setSignalStateProvider(provider: SignalRuntimeStateProvider | null): void {
    this.signalStateProvider = provider;
    this.refreshSignalState();
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
