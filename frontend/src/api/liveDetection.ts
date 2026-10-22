import { api } from './client';
import type { PersonBox } from '@/utils/personDetector';

export interface LiveDetectionReport {
  /** Identifies this browser tab; the server lets only one station feed the lights. */
  stationId: string;
  count: number;
  frameWidth: number;
  frameHeight: number;
  boxes: PersonBox[];
}

/** Sends the browser's current person detections to the API, which drives the traffic-light cycle. */
export async function postLiveDetection(report: LiveDetectionReport): Promise<void> {
  await api.post('/live/detection', report);
}
