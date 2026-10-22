import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrafficSignalMachine } from './trafficSignal.service.js';
import type { SignalController, SignalState } from './signal/controller.js';

function createFakeController() {
  const sent: SignalState[] = [];
  const controller: SignalController = {
    send: vi.fn(async (state: SignalState) => {
      sent.push(state);
    }),
    close: vi.fn(async () => undefined),
  };
  return { controller, sent };
}

/** Light changes only: RED also re-sends every second with countdown timers for the Arduino display. */
function transitions(sent: SignalState[]): SignalState[] {
  return sent.filter((state, i) => i === 0 || state !== sent[i - 1]);
}

describe('TrafficSignalMachine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts GREEN', () => {
    const { controller } = createFakeController();
    const machine = new TrafficSignalMachine(controller, { yellowMs: 3000, redMs: 20000 });
    expect(machine.getStatus().state).toBe('GREEN');
  });

  it('runs GREEN -> YELLOW -> RED -> GREEN on pedestrian detection', async () => {
    const { controller, sent } = createFakeController();
    const machine = new TrafficSignalMachine(controller, { yellowMs: 3000, redMs: 20000 });

    machine.onDetection({ detectionId: 'd1', pedestrianDetected: true, totalPedestrians: 2 });
    expect(machine.getStatus().state).toBe('YELLOW');

    await vi.advanceTimersByTimeAsync(3000);
    expect(machine.getStatus().state).toBe('RED');

    await vi.advanceTimersByTimeAsync(20000);
    expect(machine.getStatus().state).toBe('GREEN');

    expect(transitions(sent)).toEqual(['YELLOW', 'RED', 'GREEN']);
  });

  it('ignores detections with no pedestrians', async () => {
    const { controller, sent } = createFakeController();
    const machine = new TrafficSignalMachine(controller, { yellowMs: 3000, redMs: 20000 });

    machine.onDetection({ detectionId: 'd1', pedestrianDetected: false, totalPedestrians: 0 });
    expect(machine.getStatus().state).toBe('GREEN');
    expect(sent).toEqual([]);
  });

  it('extends RED while pedestrians keep being detected', async () => {
    const { controller, sent } = createFakeController();
    const machine = new TrafficSignalMachine(controller, { yellowMs: 3000, redMs: 20000 });

    machine.onDetection({ detectionId: 'd1', pedestrianDetected: true, totalPedestrians: 1 });
    await vi.advanceTimersByTimeAsync(3000);
    expect(machine.getStatus().state).toBe('RED');

    // A new pedestrian detection during RED restarts the 20s hold.
    machine.onDetection({ detectionId: 'd2', pedestrianDetected: true, totalPedestrians: 1 });
    await vi.advanceTimersByTimeAsync(19999);
    expect(machine.getStatus().state).toBe('RED');

    await vi.advanceTimersByTimeAsync(1);
    expect(machine.getStatus().state).toBe('GREEN');
    expect(transitions(sent)).toEqual(['YELLOW', 'RED', 'GREEN']);
  });

  it('forceState overrides the running cycle', async () => {
    const { controller, sent } = createFakeController();
    const machine = new TrafficSignalMachine(controller, { yellowMs: 3000, redMs: 20000 });

    machine.onDetection({ detectionId: 'd1', pedestrianDetected: true, totalPedestrians: 1 });
    await machine.forceState('GREEN');

    expect(machine.getStatus().state).toBe('GREEN');
    await vi.advanceTimersByTimeAsync(30000);
    expect(machine.getStatus().state).toBe('GREEN');
    expect(sent).toEqual(['YELLOW', 'GREEN']);
  });
});
