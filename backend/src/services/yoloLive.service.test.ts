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

describe('YoloLiveService pedestrian signal state', () => {
  const payload = {
    timestamp: Date.now(),
    detected: true,
    count: 1,
    detections: [{ class: 'person', confidence: 0.9, x1: 0, y1: 0, x2: 1, y2: 1 }],
  };

  it('reports WALK while the car light is red and waiting otherwise, with countdowns that end at null', () => {
    vi.useFakeTimers();
    const { arduino, broadcaster } = createMocks();
    const service = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);

    // Cars green: pedestrians wait and no countdown is running.
    expect(service.getSystemState().pedState).toBe('DONT_WALK');
    expect(service.getSystemState().carTimer).toBeNull();
    expect(service.getSystemState().pedTimer).toBeNull();

    service.handleDetection(payload);
    vi.advanceTimersByTime(5000);
    service.handleDetection({ ...payload, timestamp: Date.now() });

    // Caution: the car light is yellow, still not walking.
    expect(service.getSystemState().pedState).toBe('DONT_WALK');
    expect(service.getSystemState().carTimer).toBe(3);

    vi.advanceTimersByTime(3000);

    // Red: pedestrians walk and both countdowns tick.
    expect(service.getSystemState().pedState).toBe('WALK');
    expect(service.getSystemState().carTimer).toBe(15);
    expect(service.getSystemState().pedTimer).toBe(15);

    vi.advanceTimersByTime(1000);
    expect(service.getSystemState().carTimer).toBe(14);
    expect(service.getSystemState().pedTimer).toBe(14);

    vi.advanceTimersByTime(14000);
    expect(service.getSystemState().pedState).toBe('DONT_WALK');
    expect(service.getSystemState().carTimer).toBeNull();
    expect(service.getSystemState().pedTimer).toBeNull();

    vi.useRealTimers();
  });

  it('broadcasts the running countdown once per second, without duplicates or flooding', () => {
    vi.useFakeTimers();
    const { arduino, broadcaster, broadcasts } = createMocks();
    const service = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);

    service.handleDetection(payload);
    vi.advanceTimersByTime(5000);
    service.handleDetection({ ...payload, timestamp: Date.now() });
    vi.advanceTimersByTime(3000);

    const redStart = broadcasts.findIndex((state) => state.traffic === 'stopped');
    expect(redStart).toBeGreaterThan(-1);
    vi.advanceTimersByTime(4000);

    const redTimers = broadcasts.slice(redStart).map((state) => state.carTimer);
    expect(redTimers).toEqual([15, 14, 13, 12, 11]);

    vi.useRealTimers();
  });

  it('reports the operating mode and manual timers from the signal machine', () => {
    const { arduino, broadcaster, broadcasts } = createMocks();
    const service = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);

    expect(service.getSystemState().mode).toBe('auto');

    service.setSignalStateProvider(() => ({
      mode: 'manual',
      manualTimers: { greenMs: 10000, yellowMs: 2000, redMs: 12000, pedWalkMs: 8000 },
    }));
    expect(service.getSystemState().mode).toBe('manual');
    expect(service.getSystemState().manualTimers).toEqual({
      greenMs: 10000,
      yellowMs: 2000,
      redMs: 12000,
      pedWalkMs: 8000,
    });

    // A mode change is broadcast when the signal machine calls refreshSignalState().
    service.setSignalStateProvider(null);
    service.refreshSignalState();
    expect(broadcasts[broadcasts.length - 1]).toMatchObject({ mode: 'auto', manualTimers: null });
  });
});
