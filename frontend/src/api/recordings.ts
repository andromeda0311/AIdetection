import { api } from './client';
import type { RecordingInfo, RecordingStatus } from '../types';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function startRecording(cameraIndex = 0): Promise<{ recordingId: string }> {
  const response = await api.post<Envelope<{ recordingId: string }>>('/recordings/start', { cameraIndex });
  return response.data.data;
}

export async function stopRecording(): Promise<{ path: string; size: number; duration: number }> {
  const response = await api.post<Envelope<{ path: string; size: number; duration: number }>>('/recordings/stop');
  return response.data.data;
}

export async function listRecordings(): Promise<RecordingInfo[]> {
  const response = await api.get<Envelope<RecordingInfo[]>>('/recordings');
  return response.data.data;
}

export async function deleteRecording(id: string): Promise<void> {
  await api.delete(`/recordings/${id}`);
}

export async function downloadRecording(id: string): Promise<void> {
  const response = await api.get<Blob>(`/recordings/${id}`, { responseType: 'blob' });
  const blob = response.data;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `recording_${id}.webm`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}