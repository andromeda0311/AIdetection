import { onScopeDispose, ref, watch, type Ref, type ShallowRef } from 'vue';
import { postLiveDetection, type LiveDetectionReport } from '@/api/liveDetection';
import type { PersonBox } from '@/utils/personDetector';

export type ReportStatus = 'idle' | 'ok' | 'error' | 'conflict';

/** The parts of useWebcamDetection the reporter reads. */
export interface DetectionSource {
  count: Readonly<Ref<number | null>>;
  boxes: ShallowRef<PersonBox[]>;
  frameSize: Ref<{ width: number; height: number }>;
}

export interface DetectionReporterOptions {
  /** Reports are only sent while this returns true (e.g. logged in). */
  enabled?: () => boolean;
  /** Re-send while monitoring so the server's detection threshold keeps advancing. */
  heartbeatMs?: number;
  /** Minimum time between two reports. */
  minGapMs?: number;
  send?: (report: LiveDetectionReport) => Promise<void>;
}

/**
 * Reports the browser's live count to the API, which runs the traffic-light cycle.
 * Nothing is sent while detection is not running: the server then treats the feed
 * as stale after a few seconds instead of receiving a false "nobody here".
 */
export function useDetectionReporter(source: DetectionSource, options: DetectionReporterOptions = {}) {
  const enabled = options.enabled ?? (() => true);
  const heartbeatMs = options.heartbeatMs ?? 1000;
  const minGapMs = options.minGapMs ?? 250;
  const send = options.send ?? postLiveDetection;

  // Random per tab, so a second tab or computer is recognised as another station.
  const stationId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `station-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const status = ref<ReportStatus>('idle');
  const lastSentAt = ref(0);
  const lastError = ref<string | null>(null);

  let inFlight = false;
  let pending = false;
  let gapTimer: ReturnType<typeof setTimeout> | null = null;

  function buildReport(): LiveDetectionReport | null {
    const count = source.count.value;
    if (count === null) return null;
    return { stationId, count, frameWidth: source.frameSize.value.width, frameHeight: source.frameSize.value.height, boxes: source.boxes.value };
  }

  async function flush(): Promise<void> {
    if (!enabled()) return;
    if (inFlight) {
      pending = true;
      return;
    }
    const wait = lastSentAt.value + minGapMs - Date.now();
    if (wait > 0) {
      if (!gapTimer) gapTimer = setTimeout(() => { gapTimer = null; void flush(); }, wait);
      return;
    }
    const report = buildReport();
    if (!report) return;

    inFlight = true;
    lastSentAt.value = Date.now();
    try {
      await send(report);
      status.value = 'ok';
      lastError.value = null;
    } catch (err) {
      const httpStatus = (err as { response?: { status?: number } })?.response?.status;
      status.value = httpStatus === 409 ? 'conflict' : 'error';
      lastError.value = httpStatus === 409
        ? 'Another computer is already monitoring. This one is not controlling the traffic lights.'
        : err instanceof Error ? err.message : 'Report failed';
    } finally {
      inFlight = false;
      if (pending) {
        pending = false;
        void flush();
      }
    }
  }

  watch(source.count, (count, previous) => {
    if (count === null) {
      status.value = 'idle';
      return;
    }
    if (count !== previous) void flush();
  });

  const heartbeat = setInterval(() => {
    if (source.count.value !== null) void flush();
  }, heartbeatMs);

  onScopeDispose(() => {
    clearInterval(heartbeat);
    if (gapTimer) clearTimeout(gapTimer);
  });

  return { stationId, status, lastSentAt, lastError };
}
