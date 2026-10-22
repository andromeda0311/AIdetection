import type { YoloCameraInfo } from '../types';

const yoloApiBase = (import.meta.env.VITE_YOLO_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

interface CamerasResponse {
  indexes: number[];
  cameras: YoloCameraInfo[];
}

interface CameraIndexResponse {
  index: number;
}

export async function listYoloCameras(): Promise<CamerasResponse> {
  const response = await fetch(`${yoloApiBase}/cameras`);
  if (!response.ok) {
    throw new Error('Failed to load camera list from yolo-service.');
  }
  return response.json() as Promise<CamerasResponse>;
}

export async function selectYoloCamera(index: number): Promise<number> {
  const response = await fetch(`${yoloApiBase}/cameras/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? 'Failed to switch camera.');
  }
  const data = (await response.json()) as CameraIndexResponse;
  return data.index;
}

export function yoloVideoStreamUrl(baseUrl: string, cacheBust = Date.now()): string {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}t=${cacheBust}`;
}

export function yoloVideoStreamUrlForIndex(index: number, cacheBust = Date.now()): string {
  return `${yoloApiBase}/video/${index}?t=${cacheBust}`;
}
