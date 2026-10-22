import { describe, expect, it } from 'vitest';
import { parseDurationMs } from './time.js';

describe('parseDurationMs', () => {
  it('parses common units', () => {
    expect(parseDurationMs('15m')).toBe(15 * 60_000);
    expect(parseDurationMs('7d')).toBe(7 * 86_400_000);
    expect(parseDurationMs('1h')).toBe(3_600_000);
    expect(parseDurationMs('500ms')).toBe(500);
  });

  it('throws on invalid input', () => {
    expect(() => parseDurationMs('abc')).toThrow();
    expect(() => parseDurationMs('')).toThrow();
  });
});
