import { afterEach, describe, expect, it, vi } from 'vitest';
import { liveDetectionBody } from '../dto/detection.dto.js';
import { StationLock, browserReportToPayload } from './liveDetection.js';
import { YoloLiveService, type ArduinoCommandSender, type SystemStateBroadcaster } from './yoloLive.service.js';

const box = (x: number, score: number) => ({ x, y: 0.25, width: 0.2, height: 0.5, score });

function createService() {
  const commands: string[] = [];
  const arduino: ArduinoCommandSender = { send: (command) => commands.push(command), getStatus: () => 'online' };
  const broadcaster: SystemStateBroadcaster = { broadcast: () => undefined };
  return { commands, service: new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000) };
}

describe('liveDetectionBody', () => {
  it('accepts a valid report', () => {
    expect(liveDetectionBody.safeParse({ stationId: 'station-a1', count: 2, frameWidth: 640, frameHeight: 360, boxes: [box(0, 0.9), box(0.5, 0.7)] }).success).toBe(true);
    expect(liveDetectionBody.safeParse({ stationId: 'station-a1', count: 0, frameWidth: 640, frameHeight: 360, boxes: [] }).success).toBe(true);
  });

  it('rejects counts that do not match the boxes, out-of-range values and missing fields', () => {
    expect(liveDetectionBody.safeParse({ stationId: 'station-a1', count: 3, frameWidth: 640, frameHeight: 360, boxes: [box(0, 0.9)] }).success).toBe(false);
    expect(liveDetectionBody.safeParse({ stationId: 'station-a1', count: 1, frameWidth: 640, frameHeight: 360, boxes: [box(1.5, 0.9)] }).success).toBe(false);
    expect(liveDetectionBody.safeParse({ stationId: 'station-a1', count: 1, frameWidth: 640, frameHeight: 360, boxes: [box(0, 2)] }).success).toBe(false);
    expect(liveDetectionBody.safeParse({ stationId: 'station-a1', count: -1, frameWidth: 640, frameHeight: 360, boxes: [] }).success).toBe(false);
    expect(liveDetectionBody.safeParse({}).success).toBe(false);
    expect(liveDetectionBody.safeParse({ count: 0, frameWidth: 640, frameHeight: 360, boxes: [] }).success).toBe(false);
  });
});

describe('browserReportToPayload', () => {
  it('converts normalised boxes to pixels, highest confidence first, using the server clock', () => {
    const payload = browserReportToPayload({ stationId: 'station-a1', count: 2, frameWidth: 640, frameHeight: 360, boxes: [box(0.5, 0.6), box(0.1, 0.9)] }, 1234);
    expect(payload.timestamp).toBe(1234);
    expect(payload.detected).toBe(true);
    expect(payload.count).toBe(2);
    const [first] = payload.detections;
    expect(first).toMatchObject({ class: 'person', confidence: 0.9 });
    expect(first.x1).toBeCloseTo(64);
    expect(first.y1).toBeCloseTo(90);
    expect(first.x2).toBeCloseTo(192);
    expect(first.y2).toBeCloseTo(270);
    expect(payload.detections[1].confidence).toBe(0.6);
  });

  it('reports nobody in view as not detected', () => {
    const payload = browserReportToPayload({ stationId: 'station-a1', count: 0, frameWidth: 640, frameHeight: 360, boxes: [] });
    expect(payload.detected).toBe(false);
    expect(payload.detections).toEqual([]);
  });
});

describe('browser reports drive the traffic-light cycle', () => {
  afterEach(() => vi.useRealTimers());

  const report = (count: number) =>
    browserReportToPayload({ stationId: 'station-a1', count, frameWidth: 640, frameHeight: 360, boxes: Array.from({ length: count }, (_, i) => box(i * 0.2, 0.8)) });

  it('starts the caution phase after a person is reported for the threshold time', () => {
    vi.useFakeTimers();
    const { commands, service } = createService();
    for (let elapsed = 0; elapsed <= 5000; elapsed += 1000) {
      service.handleDetection(report(1));
      vi.advanceTimersByTime(1000);
    }
    expect(commands).toContain('CAUTION_TRAFFIC');
    service.close();
  });

  it('clears stale detections when reports stop, so they never start a cycle', () => {
    vi.useFakeTimers();
    const { commands, service } = createService();
    service.handleDetection(report(2));
    vi.advanceTimersByTime(3000);
    service.handleDetection(report(2));
    expect(service.getSystemState().pedestrianDetected).toBe(true);

    // The dashboard stops reporting (tab closed, camera stopped, network lost).
    vi.advanceTimersByTime(6000);
    service.markYoloOffline();
    const state = service.getSystemState();
    expect(state.yolo).toBe('offline');
    expect(state.pedestrianDetected).toBe(false);
    expect(state.pedestrianCount).toBe(0);
    expect(state.cyclePhase).toBe('IDLE');

    // A new report later must restart the threshold instead of counting the gap.
    service.handleDetection(report(1));
    expect(commands).not.toContain('CAUTION_TRAFFIC');
    expect(service.getSystemState().detectionDuration).toBe(0);
    service.close();
  });
});

describe('StationLock (one monitoring station at a time)', () => {
  it('lets the first station report and refuses a second one', () => {
    const lock = new StationLock(5000);
    expect(lock.claim('station-a', 0)).toBe(true);
    expect(lock.claim('station-a', 1000)).toBe(true);
    expect(lock.claim('station-b', 2000)).toBe(false);
  });

  it('hands over after the first station has been silent for the timeout', () => {
    const lock = new StationLock(5000);
    lock.claim('station-a', 0);
    expect(lock.claim('station-b', 5000)).toBe(false);
    expect(lock.claim('station-b', 5001)).toBe(true);
    expect(lock.claim('station-a', 6000)).toBe(false);
  });
});
