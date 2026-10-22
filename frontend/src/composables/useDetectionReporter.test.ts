import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, effectScope, nextTick, ref, shallowRef } from 'vue';
import type { LiveDetectionReport } from '@/api/liveDetection';
import type { PersonBox } from '@/utils/personDetector';
import { useDetectionReporter } from './useDetectionReporter';

const person = (x: number): PersonBox => ({ x, y: 0.1, width: 0.1, height: 0.3, score: 0.8 });

function setup(enabled = true, fail = false) {
  const boxes = shallowRef<PersonBox[]>([]);
  const running = ref(false);
  const count = computed(() => (running.value ? boxes.value.length : null));
  const frameSize = ref({ width: 640, height: 360 });
  const sent: LiveDetectionReport[] = [];
  const send = vi.fn(async (report: LiveDetectionReport) => {
    sent.push(report);
    if (fail) throw new Error('Network Error');
  });
  const scope = effectScope();
  const reporter = scope.run(() => useDetectionReporter({ count, boxes, frameSize }, { enabled: () => enabled, send, heartbeatMs: 1000, minGapMs: 250 }))!;
  return { boxes, running, sent, send, scope, reporter };
}

describe('useDetectionReporter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends nothing while detection is not running', async () => {
    const { sent, scope } = setup();
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent).toEqual([]);
    scope.stop();
  });

  it('reports count changes and keeps a 1 s heartbeat while monitoring', async () => {
    const { boxes, running, sent, scope, reporter } = setup();
    running.value = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(0);
    expect(sent.at(-1)?.count).toBe(0);

    boxes.value = [person(0), person(0.5)];
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);
    expect(sent.at(-1)).toMatchObject({ count: 2, frameWidth: 640, frameHeight: 360 });
    expect(sent.at(-1)?.boxes).toHaveLength(2);

    const before = sent.length;
    await vi.advanceTimersByTimeAsync(3000);
    expect(sent.length - before).toBeGreaterThanOrEqual(2);
    expect(reporter.status.value).toBe('ok');
    scope.stop();
  });

  it('never sends more than one report per 250 ms', async () => {
    const { boxes, running, sent, scope } = setup();
    running.value = true;
    await nextTick();
    for (let i = 1; i <= 10; i++) {
      boxes.value = Array.from({ length: i }, (_, k) => person(k * 0.05));
      await nextTick();
      await vi.advanceTimersByTimeAsync(20);
    }
    await vi.advanceTimersByTimeAsync(300);
    expect(sent.length).toBeLessThanOrEqual(3);
    expect(sent.at(-1)?.count).toBe(10);
    scope.stop();
  });

  it('stops reporting when detection stops', async () => {
    const { boxes, running, sent, scope, reporter } = setup();
    running.value = true;
    boxes.value = [person(0)];
    await nextTick();
    await vi.advanceTimersByTimeAsync(1100);
    running.value = false;
    await nextTick();
    const stoppedAt = sent.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent.length).toBe(stoppedAt);
    expect(reporter.status.value).toBe('idle');
    scope.stop();
  });

  it('does not send when disabled and reports failures', async () => {
    const off = setup(false);
    off.running.value = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(3000);
    expect(off.sent).toEqual([]);
    off.scope.stop();

    const failing = setup(true, true);
    failing.running.value = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(0);
    expect(failing.reporter.status.value).toBe('error');
    expect(failing.reporter.lastError.value).toBe('Network Error');
    failing.scope.stop();
  });
});
