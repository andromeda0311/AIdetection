import { describe, expect, it, vi } from 'vitest';
import { YoloLiveService, type ArduinoCommandSender, type SystemStateBroadcaster } from './yoloLive.service.js';

function createMocks() {
  const commands: string[] = [];
  const arduino: ArduinoCommandSender = {
    send: (command) => commands.push(command),
    getStatus: () => 'online',
  };
  const broadcasts: Array<Record<string, unknown>> = [];
  const broadcaster: SystemStateBroadcaster = {
    broadcast: (state) => broadcasts.push({ ...state }),
  };
  return { commands, arduino, broadcasts, broadcaster };
}

describe('YoloLiveService', () => {
  it('sends yellow for 3s, then red with countdown, then back to green after stop duration', () => {
    vi.useFakeTimers();
    const { commands, arduino, broadcaster } = createMocks();
    const service = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);

    const payload = {
      timestamp: Date.now(),
      detected: true,
      count: 1,
      detections: [{ class: 'person', confidence: 0.9, x1: 0, y1: 0, x2: 1, y2: 1 }],
    };

    service.handleDetection(payload);
    vi.advanceTimersByTime(4999);
    service.handleDetection({ ...payload, timestamp: Date.now() });
    expect(commands).toEqual([]);

    vi.advanceTimersByTime(1);
    service.handleDetection({ ...payload, timestamp: Date.now() });
    expect(commands).toContain('CAUTION_TRAFFIC');
    expect(service.getSystemState().traffic).toBe('caution');

    vi.advanceTimersByTime(3000);
    expect(commands).toContain('STOP_TRAFFIC');
    expect(commands).toContain('COUNTDOWN:CARS:15');
    expect(commands).toContain('COUNTDOWN:PEDS:15');
    expect(service.getSystemState().traffic).toBe('stopped');

    vi.advanceTimersByTime(15000);
    expect(commands).toContain('NORMAL_TRAFFIC');
    expect(commands).toContain('COUNTDOWN:CARS:00');
    expect(commands).toContain('COUNTDOWN:PEDS:00');
    expect(service.getSystemState().traffic).toBe('normal');

    vi.useRealTimers();
  });

  it('applies setDurations to the next pedestrian cycle and broadcasts autoStopSec', () => {
    vi.useFakeTimers();
    const { commands, arduino, broadcaster, broadcasts } = createMocks();
    const service = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);

    service.setDurations({ stopDurationMs: 8000 });
    expect(service.getSystemState().autoStopSec).toBe(8);
    expect(broadcasts[broadcasts.length - 1].autoStopSec).toBe(8);

    const payload = {
      timestamp: Date.now(),
      detected: true,
      count: 1,
      detections: [{ class: 'person', confidence: 0.9, x1: 0, y1: 0, x2: 1, y2: 1 }],
    };

    service.handleDetection(payload);
    vi.advanceTimersByTime(5000);
    service.handleDetection({ ...payload, timestamp: Date.now() });
    expect(service.getSystemState().traffic).toBe('caution');

    vi.advanceTimersByTime(3000);
    expect(commands).toContain('STOP_TRAFFIC');
    expect(commands).toContain('COUNTDOWN:CARS:08');
    expect(commands).toContain('COUNTDOWN:PEDS:08');

    vi.advanceTimersByTime(8000);
    expect(commands).toContain('NORMAL_TRAFFIC');
    expect(service.getSystemState().traffic).toBe('normal');

    vi.useRealTimers();
  });
});
