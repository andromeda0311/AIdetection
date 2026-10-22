import type { LiveDetectionBody } from '../dto/detection.dto.js';
import type { YoloDetectionPayload } from './yoloLive.service.js';

/**
 * Only one monitoring station (browser tab) may feed the traffic-light cycle.
 * The first station to report holds it; another is refused until the holder has
 * been silent for `timeoutMs` (closed tab, stopped camera, lost connection).
 */
export class StationLock {
  private holder: { id: string; lastSeen: number } | null = null;

  constructor(private readonly timeoutMs = 5000) {}

  claim(stationId: string, now = Date.now()): boolean {
    if (!this.holder || this.holder.id === stationId || now - this.holder.lastSeen > this.timeoutMs) {
      this.holder = { id: stationId, lastSeen: now };
      return true;
    }
    return false;
  }
}

export const monitoringStation = new StationLock();

/**
 * Converts a dashboard (browser webcam) report into the payload the live
 * traffic-light service already handles. The server clock is used so a wrong
 * client clock cannot affect the detection threshold timing.
 */
export function browserReportToPayload(body: LiveDetectionBody, now = Date.now()): YoloDetectionPayload {
  const { frameWidth, frameHeight } = body;
  return {
    timestamp: now,
    detected: body.count > 0,
    count: body.count,
    frameWidth,
    frameHeight,
    detections: body.boxes
      .slice()
      .sort((a, b) => b.score - a.score)
      .map((box) => ({
        class: 'person',
        confidence: box.score,
        x1: box.x * frameWidth,
        y1: box.y * frameHeight,
        x2: (box.x + box.width) * frameWidth,
        y2: (box.y + box.height) * frameHeight,
      })),
  };
}
