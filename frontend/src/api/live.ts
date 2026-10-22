import { api } from './client';
import type { LiveSystemState } from '../types';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getLiveSystemStatus(): Promise<LiveSystemState> {
  const response = await api.get<Envelope<LiveSystemState>>('/system/status');
  return response.data.data;
}
