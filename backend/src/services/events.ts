import { EventEmitter } from 'node:events';

export const DETECTION_COMPLETED = 'detection:completed';

export interface DetectionCompletedEvent {
  detectionId: string;
  pedestrianDetected: boolean;
  totalPedestrians: number;
}

export const appEvents = new EventEmitter();
appEvents.setMaxListeners(20);
