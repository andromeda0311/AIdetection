export type Role = 'admin' | 'staff';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DetectionStatus = 'processing' | 'completed' | 'failed';

export interface Detection {
  id: string;
  staffUserId: string;
  inputFileName: string;
  inputContentType: string;
  inputSizeBytes: number;
  status: DetectionStatus;
  pedestrianDetected: boolean;
  totalPedestrians: number;
  detectionMeta: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DetectionFrame {
  id: string;
  detectionId: string;
  frameIndex: number;
  contentType: string | null;
  pedestrianCount: number;
  boxes: DetectionBox[];
  createdAt: string;
}

export interface DetectionBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  className: string;
}

export type SignalState = 'GREEN' | 'YELLOW' | 'RED';
export type PedestrianState = 'WALK' | 'DONT_WALK';
export type SignalMode = 'auto' | 'manual';

export interface SignalStatus {
  state: SignalState;
  since: string;
  mode: SignalMode;
  manualTimers: ManualTimers;
}

export interface SignalUpdate {
  state: SignalState;
  pedState: PedestrianState;
  carTimer: number | null;
  pedTimer: number | null;
  triggeredBy: 'AUTO' | 'ADMIN';
  timestamp: string;
}

export interface ManualTimers {
  greenMs: number;
  yellowMs: number;
  redMs: number;
  pedWalkMs: number;
}

export interface RecordingStatus {
  status: 'idle' | 'recording' | 'saving';
  startedAt: number | null;
  duration: number;
  fileName: string | null;
}

export interface RecordingInfo {
  id: string;
  filename: string;
  path: string;
  size: number;
  duration: number;
  createdAt: string;
}

export interface SignalEvent {
  id: string;
  state: SignalState;
  triggered_by: 'auto' | 'admin';
  detection_id: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  state: SignalState;
  triggeredBy: 'auto' | 'admin';
  arduinoTransport: 'log' | 'serial' | 'http';
  detectionId: string | null;
  userId: string | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: Role;
  } | null;
  detection?: {
    id: string;
    inputFileName: string;
    status: DetectionStatus;
    totalPedestrians: number;
  } | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DetectionListResult {
  detections: Detection[];
  total: number;
  page: number;
  limit: number;
}

export interface LiveDetectionBox {
  className: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LiveCameraView {
  index: number;
  name?: string | null;
  online: boolean;
  detected: boolean;
  count: number;
  confidence: number;
  detections: LiveDetectionBox[];
  frameWidth: number;
  frameHeight: number;
}

export interface LiveSystemState {
  yolo: 'online' | 'offline';
  camera: 'online' | 'offline';
  arduino: 'online' | 'offline';
  traffic: 'normal' | 'caution' | 'stopped';
  pedestrianDetected: boolean;
  pedestrianCount: number;
  confidence: number;
  detectionDuration: number;
  cycleActive?: boolean;
  cyclePhase?: 'IDLE' | 'THRESHOLD' | 'CAUTION' | 'STOPPED';
  cycleRemainingSec?: number;
  thresholdRequiredSec?: number;
  autoStopSec?: number;
  detections: LiveDetectionBox[];
  frameWidth: number;
  frameHeight: number;
  cameras?: LiveCameraView[];
  fusionMode?: string;
  degraded?: boolean;
  updatedAt: number;
  // Pedestrian signal and timers
  pedState?: PedestrianState;
  carTimer?: number | null;
  pedTimer?: number | null;
  // Mode and manual timers
  mode?: SignalMode;
  manualTimers?: ManualTimers;
  // Recording
  recording?: RecordingStatus;
}

export interface YoloCameraInfo {
  index: number;
  label: string;
  name?: string | null;
  width?: number;
  height?: number;
}

// Socket.io event types (SignalR-like hub contract)
export interface ServerToClientEvents {
  'system:state': (state: LiveSystemState) => void;
  'traffic:changed': (data: { from: string; to: string; timestamp: number }) => void;
  'arduino:command': (data: { command: string; ackId: string }) => void;
  'arduino:ack': (data: { ackId: string; success: boolean; response?: string }) => void;
  'yolo:offline': (data: { reason: string }) => void;
  'yolo:toggle': (data: { enabled: boolean }) => void;
  'signal:update': (data: SignalUpdate) => void;
  'signal:mode': (data: { mode: SignalMode }) => void;
  'signal:manualTimers': (data: ManualTimers) => void;
  'recording:status': (data: RecordingStatus) => void;
  'ui:mode/set': (data: { ok: boolean; reason?: string; state?: any }) => void;
  'ui:manual/press': (data: { ok: boolean; reason?: string; state?: any }) => void;
  'ui:manual/scenario': (data: { ok: boolean; reason?: string; state?: any }) => void;
}

export interface ClientToServerEvents {
  'ui:request_state': (callback: (response: { state: LiveSystemState }) => void) => void;
  'ui:override_traffic': (data: { traffic: 'normal' | 'caution' | 'stopped' }, callback: (response: { success: boolean; state?: LiveSystemState }) => void) => void;
  'ui:subscribe': (data: { room: 'dashboard' | 'admin' }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'ui:arduino_ping': (callback: (response: { pong: boolean }) => void) => void;
  'ui:mode/set': (data: { mode: 'AUTO' | 'MANUAL' }, callback: (response: { ok: boolean; reason?: string }) => void) => void;
  'ui:manual/press': (data: { phase: 'GREEN' | 'YELLOW' | 'RED' }, callback: (response: { ok: boolean; reason?: string }) => void) => void;
  'ui:manual/scenario': (data: { name: 'QUICK_TEST' | 'FULL_CYCLE' | 'PEDESTRIAN_TEST' }, callback: (response: { ok: boolean; reason?: string }) => void) => void;
}
