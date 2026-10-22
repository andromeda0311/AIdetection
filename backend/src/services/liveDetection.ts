import type { LiveDetectionBody } from '../dto/detection.dto.js';
import type { YoloDetectionPayload } from './yoloLive.service.js';

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
