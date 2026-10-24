import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YoloLiveService, type ArduinoCommandSender, type SignalTransition, type SystemStateBroadcaster } from './yoloLive.service.js';
import { setYoloEnabled } from './yoloEnabled.js';

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

const detectionPayload = () => ({
  timestamp: Date.now(),
  detected: true,
  count: 1,
  detections: [{ class: 'person', confidence: 0.9, x1: 0, y1: 0, x2: 1, y2: 1 }],
});

describe('YoloLiveService manual mode (auto cycle disabled)', () => {
  afterEach(() => vi.useRealTimers());

  it('does not change the light from detections, and resumes cycles back in auto', () => {
    vi.useFakeTimers();
    const { commands, arduino, broadcaster } = createMocks();
    const service = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);

    service.setAutoCycleEnabled(false);
    for (let elapsed = 0; elapsed <= 5000; elapsed += 1000) {
      service.handleDetection(detectionPayload());
      vi.advanceTimersByTime(1000);
    }
    // Counts keep updating, but no phase or countdown command is ever sent.
    expect(service.getSystemState().pedestrianCount).toBe(1);
    expect(service.getSystemState().traffic).toBe('normal');
    expect(service.getSystemState().cyclePhase).toBe('IDLE');
    expect(commands).toEqual([]);

    // Back in automatic mode a fresh detection reaches the threshold again.
    service.setAutoCycleEnabled(true);
    service.handleDetection(detectionPayload());
    vi.advanceTimersByTime(5000);
    service.handleDetection({ ...detectionPayload(), timestamp: Date.now() });
    expect(service.getSystemState().traffic).toBe('caution');
    expect(commands).toContain('CAUTION_TRAFFIC');

    service.close();
  });

  it('lets a cycle that is already running finish when manual mode begins', () => {
    vi.useFakeTimers();
    const { commands, arduino, broadcaster } = createMocks();
    const service = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);

    service.handleDetection(detectionPayload());
    vi.advanceTimersByTime(5000);
    service.handleDetection({ ...detectionPayload(), timestamp: Date.now() });
    expect(service.getSystemState().traffic).toBe('caution');

    service.setAutoCycleEnabled(false);
    service.handleDetection({ ...detectionPayload(), timestamp: Date.now() });

    // The running cycle is not cut off: it continues on its own timers.
    vi.advanceTimersByTime(3000);
    expect(service.getSystemState().traffic).toBe('stopped');
    expect(commands).toContain('STOP_TRAFFIC');

    vi.advanceTimersByTime(15000);
    expect(service.getSystemState().traffic).toBe('normal');
    expect(commands).toContain('NORMAL_TRAFFIC');

    // ...and no new cycle starts from the detections reported in manual mode.
    for (let elapsed = 0; elapsed <= 6000; elapsed += 1000) {
      service.handleDetection(detectionPayload());
      vi.advanceTimersByTime(1000);
    }
    expect(service.getSystemState().traffic).toBe('normal');

    service.close();
  });
});

describe('YoloLiveService forced phases', () => {
  afterEach(() => vi.useRealTimers());

  it('applies a held phase immediately and broadcasts without waiting for the throttle', () => {
    const { commands, arduino, broadcaster, broadcasts } = createMocks();
    const service = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);

    const before = broadcasts.length;
    service.forcePhase('RED', { triggeredBy: 'admin' });

    expect(service.getSystemState().traffic).toBe('stopped');
    expect(service.getSystemState().pedState).toBe('WALK');
    expect(commands).toContain('STOP_TRAFFIC');
    expect(broadcasts.length).toBeGreaterThan(before);
    expect(broadcasts[broadcasts.length - 1]).toMatchObject({ traffic: 'stopped' });

    // Held: no countdown runs and the phase stays past the stop duration.
    vi.useFakeTimers();
    vi.advanceTimersByTime(60000);
    expect(service.getSystemState().traffic).toBe('stopped');

    service.close();
  });

  it('returns a forced phase with a duration to GREEN after the duration', () => {
    vi.useFakeTimers();
    const { commands, arduino, broadcaster } = createMocks();
    const service = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);

    service.forcePhase('RED', { durationMs: 4000, triggeredBy: 'admin' });
    expect(service.getSystemState().traffic).toBe('stopped');
    expect(service.getSystemState().carTimer).toBe(4);
    expect(service.getSystemState().pedTimer).toBe(4);

    vi.advanceTimersByTime(4000);
    expect(service.getSystemState().traffic).toBe('normal');
    expect(service.getSystemState().carTimer).toBeNull();
    expect(commands).toContain('NORMAL_TRAFFIC');

    service.close();
  });

  it('cancels a running cycle when a phase is forced', () => {
    vi.useFakeTimers();
    const { commands, arduino, broadcaster } = createMocks();
    const service = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);

    service.handleDetection(detectionPayload());
    vi.advanceTimersByTime(5000);
    service.handleDetection({ ...detectionPayload(), timestamp: Date.now() });
    expect(service.getSystemState().traffic).toBe('caution');

    service.forcePhase('GREEN', { triggeredBy: 'admin' });
    expect(service.getSystemState().traffic).toBe('normal');
    expect(commands).toContain('NORMAL_TRAFFIC');
    expect(commands).toContain('COUNTDOWN:CARS:00');

    vi.advanceTimersByTime(20000);
    expect(service.getSystemState().traffic).toBe('normal');

    service.close();
  });
});

describe('YoloLiveService transition listeners', () => {
  afterEach(() => vi.useRealTimers());

  it('fires for every automatic phase change with auto attribution', () => {
    vi.useFakeTimers();
    const { arduino, broadcaster } = createMocks();
    const service = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);

    const transitions: SignalTransition[] = [];
    service.onTransition((transition) => transitions.push(transition));

    service.handleDetection(detectionPayload());
    vi.advanceTimersByTime(5000);
    service.handleDetection({ ...detectionPayload(), timestamp: Date.now() });
    vi.advanceTimersByTime(3000);
    vi.advanceTimersByTime(15000);

    expect(transitions.map((transition) => transition.phase)).toEqual(['YELLOW', 'RED', 'GREEN']);
    expect(transitions.every((transition) => transition.triggeredBy === 'auto')).toBe(true);
    expect(transitions[0]).toMatchObject({ carTimer: 3, pedTimer: null, pedState: 'DONT_WALK' });
    expect(transitions[1]).toMatchObject({ carTimer: 15, pedTimer: 15, pedState: 'WALK' });
    expect(transitions[2]).toMatchObject({ carTimer: null, pedTimer: null, pedState: 'DONT_WALK' });

    service.close();
  });

  it('attributes a manual cycle and forced phases to admin', () => {
    vi.useFakeTimers();
    const { arduino, broadcaster } = createMocks();
    const service = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);

    const transitions: SignalTransition[] = [];
    service.onTransition((transition) => transitions.push(transition));

    service.forcePhase('RED', { triggeredBy: 'admin' });
    service.runManualCycle({ yellowMs: 2000, redMs: 5000 }, 'admin');
    vi.advanceTimersByTime(7000);

    expect(transitions.map((transition) => transition.phase)).toEqual(['RED', 'YELLOW', 'RED', 'GREEN']);
    expect(transitions.every((transition) => transition.triggeredBy === 'admin')).toBe(true);

    service.close();
  });
});

describe('YoloLiveService arduino transport in system state', () => {
  it('reports the configured transport in system:state and /api/system/status data', () => {
    const { arduino, broadcaster, broadcasts } = createMocks();
    const service = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);

    expect(service.getSystemState().arduinoTransport).toBe('log');

    service.setArduinoTransport('serial');
    expect(service.getSystemState().arduinoTransport).toBe('serial');
    expect(broadcastsContain(broadcasts, 'serial')).toBe(true);
  });
});

function broadcastsContain(broadcasts: Array<Record<string, unknown>>, transport: string): boolean {
  return broadcasts.some((state) => state.arduinoTransport === transport);
}

describe('YoloLiveService activity events', () => {
  afterEach(() => vi.useRealTimers());
  const noDetection = {
    timestamp: 0,
    detected: false,
    count: 0,
    detections: [],
  };

  function activityMocks() {
    const mocks = createMocks();
    const events: Array<{ type: string; peopleCount?: number }> = [];
    return { ...mocks, events };
  }

  it('emits detected once per false -> true change, with the people count', () => {
    vi.useFakeTimers();
    const { arduino, broadcaster, events } = activityMocks();
    const service = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);
    service.onActivity((event) => events.push(event));

    // A person appears.
    service.handleDetection(detectionPayload());
    // They stay in the frame: no second event.
    vi.advanceTimersByTime(1000);
    service.handleDetection({ ...detectionPayload(), timestamp: Date.now() });
    // They leave and appear again.
    service.handleDetection({ ...noDetection, detected: false, timestamp: Date.now() });
    service.handleDetection({ ...detectionPayload(), count: 3, timestamp: Date.now() });

    expect(events).toEqual([
      { type: 'detected', peopleCount: 1 },
      { type: 'detected', peopleCount: 3 },
    ]);

    service.close();
  });

  it('emits cycle_started only for automatic cycles, not forced or manual ones', () => {
    vi.useFakeTimers();
    const { arduino, broadcaster, events } = activityMocks();
    const service = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);
    service.onActivity((event) => events.push(event));

    // An automatic cycle starts after the detection threshold.
    service.handleDetection(detectionPayload());
    vi.advanceTimersByTime(5000);
    service.handleDetection({ ...detectionPayload(), timestamp: Date.now() });

    // Forced and manual cycles are admin actions, not traffic-driven ones.
    service.forcePhase('RED', { triggeredBy: 'admin' });
    vi.clearAllTimers();
    events.length = 0;
    service.forcePhase('RED', { durationMs: 5000, triggeredBy: 'admin' });
    vi.clearAllTimers();
    service.runManualCycle({ yellowMs: 2000, redMs: 5000 }, 'admin');
    vi.clearAllTimers();

    expect(events).toEqual([]);

    // ...but a second automatic cycle is announced again.
    events.length = 0;
    service.forcePhase('GREEN', { triggeredBy: 'admin' });
    vi.clearAllTimers();
    service.setAutoCycleEnabled(false);
    service.setAutoCycleEnabled(true);
    service.handleDetection(detectionPayload());
    vi.advanceTimersByTime(5000);
    service.handleDetection({ ...detectionPayload(), timestamp: Date.now() });
    expect(events).toEqual([{ type: 'cycle_started' }]);

    service.close();
  });
});

describe('YoloLiveService YOLO enable toggle', () => {
  beforeEach(() => setYoloEnabled(true));
  afterEach(() => setYoloEnabled(true));

  it('applies the toggle without a restart and broadcasts its state at once', () => {
    const { arduino, broadcaster, broadcasts } = createMocks();
    const service = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);

    expect(service.getSystemState().yolo).toBe('offline'); // no feed reported yet

    setYoloEnabled(false);
    const before = broadcasts.length;
    service.refreshYoloEnabled();

    expect(service.getSystemState().yolo).toBe('offline');
    expect(broadcasts.length).toBeGreaterThan(before);
    // The engine stays offline while disabled and never starts a cycle.
    service.handleDetection(detectionPayload());
    expect(service.getSystemState().yolo).toBe('offline');
    expect(service.getSystemState().traffic).toBe('normal');

    // Re-enabling takes effect on the next detection, again without a restart.
    setYoloEnabled(true);
    service.handleDetection(detectionPayload());
    expect(service.getSystemState().yolo).toBe('online');

    service.close();
  });
});
