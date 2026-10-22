import { describe, expect, it } from 'vitest';
import { mergeSignalUpdate, normalizeLiveState } from './useLiveSystemState';
import type { LiveSystemState, SignalUpdate } from '../types';

function baseState(overrides: Partial<LiveSystemState> = {}): LiveSystemState {
  return {
    yolo: 'online',
    camera: 'online',
    arduino: 'offline',
    traffic: 'normal',
    pedestrianDetected: false,
    pedestrianCount: 0,
    confidence: 0,
    detectionDuration: 0,
    detections: [],
    frameWidth: 0,
    frameHeight: 0,
    updatedAt: 1,
    ...overrides,
  };
}

describe('mergeSignalUpdate', () => {
  it('applies the pedestrian state and countdowns carried by signal:update', () => {
    const update: SignalUpdate = {
      state: 'RED',
      pedState: 'WALK',
      carTimer: 15,
      pedTimer: 15,
      triggeredBy: 'AUTO',
      timestamp: '2026-10-23T10:00:00.000Z',
    };
    const merged = mergeSignalUpdate(baseState({ traffic: 'normal' }), update);
    expect(merged.pedState).toBe('WALK');
    expect(merged.carTimer).toBe(15);
    expect(merged.pedTimer).toBe(15);
  });

  it('does not clobber the live cycle fields the event does not carry', () => {
    const update: SignalUpdate = {
      state: 'RED',
      pedState: 'WALK',
      carTimer: 9,
      pedTimer: 6,
      triggeredBy: 'AUTO',
      timestamp: '2026-10-23T10:00:01.000Z',
    };
    const merged = mergeSignalUpdate(baseState({ traffic: 'stopped', cyclePhase: 'STOPPED', cycleRemainingSec: 12 }), update);
    expect(merged.traffic).toBe('stopped');
    expect(merged.cyclePhase).toBe('STOPPED');
    expect(merged.cycleRemainingSec).toBe(12);
  });

  it('clears the countdowns and keeps the wait state when a green phase starts', () => {
    const update: SignalUpdate = {
      state: 'GREEN',
      pedState: 'DONT_WALK',
      carTimer: null,
      pedTimer: null,
      triggeredBy: 'AUTO',
      timestamp: '2026-10-23T10:00:05.000Z',
    };
    const merged = mergeSignalUpdate(baseState({ pedState: 'WALK', carTimer: 1, pedTimer: 1 }), update);
    expect(merged.pedState).toBe('DONT_WALK');
    expect(merged.carTimer).toBeNull();
    expect(merged.pedTimer).toBeNull();
  });

  it('applies the mode and manual timers from the signal machine when given', () => {
    const update: SignalUpdate = {
      state: 'RED',
      pedState: 'WALK',
      carTimer: 20,
      pedTimer: 15,
      triggeredBy: 'ADMIN',
      timestamp: '2026-10-23T10:00:02.000Z',
    };
    const merged = mergeSignalUpdate(
      baseState({ mode: 'auto', manualTimers: { greenMs: 30000, yellowMs: 3000, redMs: 20000, pedWalkMs: 15000 } }),
      update,
    );
    expect(merged.mode).toBe('auto');
    expect(merged.manualTimers).toEqual({ greenMs: 30000, yellowMs: 3000, redMs: 20000, pedWalkMs: 15000 });
  });
});

describe('normalizeLiveState', () => {
  it('fills the defaults the live state cards expect', () => {
    const normalized = normalizeLiveState(baseState({ detections: undefined as unknown as LiveSystemState['detections'], updatedAt: undefined as unknown as number }));
    expect(normalized.detections).toEqual([]);
    expect(normalized.updatedAt).toBeGreaterThan(0);
  });
});
