import { describe, expect, it } from 'vitest';
import { describeCameraError } from './useWebcamDetection';

describe('describeCameraError', () => {
  it.each([
    ['NotAllowedError', /permission was denied/],
    ['NotFoundError', /not found/],
    ['OverconstrainedError', /not found/],
    ['NotReadableError', /in use by another application/],
  ])('explains %s', (name, expected) => {
    expect(describeCameraError(new DOMException('x', name))).toMatch(expected);
  });

  it('falls back to the browser message for unknown errors', () => {
    expect(describeCameraError(new Error('boom'))).toBe('Camera error: boom');
    expect(describeCameraError('weird')).toBe('The camera could not be started.');
  });
});
