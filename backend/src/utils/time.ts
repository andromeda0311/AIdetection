const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

/**
 * Parses a duration string such as "15m", "7d", "1h" into milliseconds.
 */
export function parseDurationMs(input: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d|w)$/.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid duration: "${input}". Expected a value like "15m" or "7d".`);
  }
  return Number(match[1]) * UNIT_MS[match[2]];
}
