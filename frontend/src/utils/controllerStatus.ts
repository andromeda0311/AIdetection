import type { LiveSystemState } from '../types';

/**
 * Honest status of the signal controller: the log transport is not a device, so
 * "online" may only be shown when a real (serial) controller answers. Used by
 * Diagnostics, System Settings and System Testing so all screens agree.
 */
export function controllerStatusLabel(connected: boolean, state: LiveSystemState | null): string {
  if (state?.arduinoTransport === 'log') return 'Not connected (log mode)';
  if (connected && state?.arduino === 'online') return 'online';
  return 'offline';
}

/**
 * Honest status of the countdown timers card: online while a cycle runs (at
 * least one timer ticks), idle when the connection is up but no phase runs.
 */
export function countdownCardStatus(
  connected: boolean,
  state: LiveSystemState | null,
): 'online' | 'idle' | 'offline' {
  if (!connected) return 'offline';
  const timerRunning = state?.carTimer != null || state?.pedTimer != null;
  return timerRunning ? 'online' : 'idle';
}

/** Card description matching the status above: what to look at while idle. */
export function countdownCardDetail(connected: boolean, state: LiveSystemState | null): string {
  return countdownCardStatus(connected, state) === 'idle' ? 'No cycle running' : 'Live cycle timing and clearance';
}
