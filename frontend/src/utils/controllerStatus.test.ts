import { describe, expect, it } from 'vitest';
import { controllerStatusLabel, countdownCardStatus, countdownCardDetail } from './controllerStatus';
import type { LiveSystemState } from '../types';

function state(overrides: Partial<LiveSystemState> = {}): LiveSystemState {
  return {
    yolo: 'online',
    camera: 'online',
    arduino: 'online',
    traffic: 'normal',
    pedestrianDetected: false,
    pedestrianCount: 0,
    confidence: 0,
    detectionDuration: 0,
    detections: [],
    frameWidth: 0,
    frameHeight: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('controllerStatusLabel', () => {
  it('reports "Not connected (log mode)" for the log transport, never a fake online', () => {
    expect(controllerStatusLabel(true, state({ arduinoTransport: 'log', arduino: 'offline' }))).toBe('Not connected (log mode)');
  });

  it('shows online only while a serial controller answers', () => {
    expect(controllerStatusLabel(true, state({ arduinoTransport: 'serial', arduino: 'online' }))).toBe('online');
    expect(controllerStatusLabel(true, state({ arduinoTransport: 'serial', arduino: 'offline' }))).toBe('offline');
  });

  it('stays offline without a connection or live state', () => {
    expect(controllerStatusLabel(false, null)).toBe('offline');
    expect(controllerStatusLabel(true, null)).toBe('offline');
    expect(controllerStatusLabel(false, state({ arduinoTransport: 'serial', arduino: 'online' }))).toBe('offline');
  });
});

describe('countdownCardStatus', () => {
  it('is online while a cycle ticks at least one timer', () => {
    expect(countdownCardStatus(true, state({ carTimer: 12, pedTimer: 12 }))).toBe('online');
    expect(countdownCardStatus(true, state({ carTimer: null, pedTimer: 5 }))).toBe('online');
  });

  it('is idle when the connection is up but no cycle runs', () => {
    expect(countdownCardStatus(true, state({ carTimer: null, pedTimer: null }))).toBe('idle');
    expect(countdownCardStatus(true, null)).toBe('idle');
  });

  it('is offline without a connection', () => {
    expect(countdownCardStatus(false, state({ carTimer: 12 }))).toBe('offline');
  });

  it('describes what to look at while idle', () => {
    expect(countdownCardDetail(true, state({ carTimer: null }))).toBe('No cycle running');
    expect(countdownCardDetail(true, state({ carTimer: 3 }))).toBe('Live cycle timing and clearance');
  });
});
