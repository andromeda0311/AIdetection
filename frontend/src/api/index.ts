import { api } from './client';
import type {
  Detection,
  DetectionFrame,
  DetectionListResult,
  SignalEvent,
  SignalState,
  SignalStatus,
  SignalMode,
  ManualTimers,
  StaffUser,
  AuditLog,
  DetectionActivity,
} from '../types';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function listDetections(page = 1, limit = 20): Promise<DetectionListResult> {
  const response = await api.get<Envelope<DetectionListResult>>('/detections', {
    params: { page, limit },
  });
  return response.data.data;
}

export async function getDetection(id: string): Promise<{ detection: Detection; frames: DetectionFrame[] }> {
  const response = await api.get<Envelope<{ detection: Detection; frames: DetectionFrame[] }>>(`/detections/${id}`);
  return response.data.data;
}

export async function uploadDetectionVideo(file: File): Promise<{ detection: Detection }> {
  const form = new FormData();
  form.append('file', file);
  const response = await api.post<Envelope<{ detection: Detection }>>('/detections/upload', form);
  return response.data.data;
}

/** Relative to the axios baseURL (`/api`) — do not prepend baseURL again in callers. */
export function detectionInputUrl(id: string): string {
  return `/detections/${id}/input/file`;
}

export function frameFileUrl(id: string, frameId: string): string {
  return `/detections/${id}/frames/${frameId}/file`;
}

export async function listStaff(): Promise<StaffUser[]> {
  const response = await api.get<Envelope<{ users: StaffUser[] }>>('/staff');
  return response.data.data.users;
}

export async function createStaff(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'staff';
}): Promise<StaffUser> {
  const response = await api.post<Envelope<{ user: StaffUser }>>('/staff', input);
  return response.data.data.user;
}

export async function updateStaff(
  id: string,
  input: Partial<{ firstName: string; lastName: string; role: 'admin' | 'staff'; isActive: boolean }>,
): Promise<StaffUser> {
  const response = await api.patch<Envelope<{ user: StaffUser }>>(`/staff/${id}`, input);
  return response.data.data.user;
}

export async function deactivateStaff(id: string): Promise<void> {
  await api.delete(`/staff/${id}`);
}

export async function getSignalStatus(): Promise<SignalStatus> {
  const response = await api.get<Envelope<SignalStatus>>('/signal/status');
  return response.data.data;
}

export async function listSignalEvents(limit = 50): Promise<SignalEvent[]> {
  const response = await api.get<Envelope<{ events: SignalEvent[] }>>('/signal/events', {
    params: { limit },
  });
  return response.data.data.events;
}

export interface AuditLogFilters {
  state?: 'GREEN' | 'YELLOW' | 'RED';
  triggeredBy?: 'auto' | 'admin';
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export async function listAuditLogs(
  params: AuditLogFilters = {},
): Promise<{ items: AuditLog[]; total: number; limit: number; offset: number }> {
  const response = await api.get<Envelope<{ items: AuditLog[]; total: number; limit: number; offset: number }>>(
    '/audit',
    { params },
  );
  return response.data.data;
}

/** The most recent stored pedestrian events (server-side, survives a reload). */
export async function getRecentActivity(limit = 5): Promise<DetectionActivity[]> {
  const response = await api.get<Envelope<{ items: DetectionActivity[] }>>('/activity/recent', {
    params: { limit },
  });
  return response.data.data.items;
}

export async function exportAuditLogsCsv(): Promise<void> {
  await downloadFile('/audit/export', 'traffic-light-audit-logs.csv');
}

export async function forceSignal(state: SignalState): Promise<SignalStatus> {
  const response = await api.post<Envelope<SignalStatus>>(`/signal/${state.toLowerCase()}`);
  return response.data.data;
}

// New API functions for mode and manual timers
export async function getSignalMode(): Promise<{ mode: SignalMode }> {
  const response = await api.get<Envelope<{ mode: SignalMode }>>('/signal/mode');
  return response.data.data;
}

export async function setSignalMode(mode: SignalMode): Promise<{ mode: SignalMode }> {
  const response = await api.put<Envelope<{ mode: SignalMode }>>('/signal/mode', { mode });
  return response.data.data;
}

export async function getManualTimers(): Promise<ManualTimers> {
  const response = await api.get<Envelope<ManualTimers>>('/signal/manual-timers');
  return response.data.data;
}

export async function setManualTimers(timers: Partial<ManualTimers>): Promise<ManualTimers> {
  const response = await api.put<Envelope<ManualTimers>>('/signal/manual-timers', timers);
  return response.data.data;
}

export async function forcePhase(state: SignalState, durationMs?: number): Promise<SignalStatus> {
  const response = await api.post<Envelope<SignalStatus>>('/signal/force-phase', { state, durationMs });
  return response.data.data;
}

export async function triggerManualCycle(): Promise<SignalStatus> {
  const response = await api.post<Envelope<SignalStatus>>('/signal/trigger-cycle');
  return response.data.data;
}

/** The automatic-cycle timings of the live signal engine plus the mode and manual timers (ms). */
export interface SignalConfig {
  detectionThresholdMs: number;
  yellowMs: number;
  redMs: number;
  mode: SignalMode;
  manualGreenMs: number | null;
  manualYellowMs: number | null;
  manualRedMs: number | null;
  manualPedWalkMs: number | null;
}

export type SignalTimingUpdate = Partial<Pick<SignalConfig, 'detectionThresholdMs' | 'yellowMs' | 'redMs'>>;

export async function getSignalConfig(): Promise<SignalConfig> {
  const response = await api.get<Envelope<SignalConfig>>('/signal/config');
  return response.data.data;
}

export async function updateSignalConfig(payload: SignalTimingUpdate): Promise<SignalConfig> {
  const response = await api.put<Envelope<SignalConfig>>('/signal/config', payload);
  return response.data.data;
}

export async function fetchFileBlob(url: string): Promise<Blob> {
  const response = await api.get<Blob>(url, { responseType: 'blob' });
  return response.data;
}

export async function downloadFile(url: string, filename: string): Promise<void> {
  const blob = await fetchFileBlob(url);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

export async function exportSignalEventsCSV(): Promise<void> {
  await downloadFile('/signal/events/export', 'signal-events.csv');
}
