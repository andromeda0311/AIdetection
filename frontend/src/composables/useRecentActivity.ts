import { getCurrentInstance, onUnmounted, ref } from 'vue';
import { getRecentActivity } from '../api';
import type { DetectionActivity } from '../types';

/** A row of the dashboard's Recent Detection Activity table. */
export interface DashboardActivityRow { id: string; time: string; event: string; triggered: boolean }

export const ACTIVITY_ROW_LIMIT = 5;
/** Debounce before refetching: the server needs a beat to store the new event. */
export const ACTIVITY_REFRESH_DEBOUNCE_MS = 1000;

/** Time cell formatting: 12-hour clock with seconds, e.g. "03:24:12 PM". */
export function formatActivityTime(occurredAt: string): string {
  return new Date(occurredAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

export function activityToRow(event: DetectionActivity): DashboardActivityRow {
  return { id: event.id, time: formatActivityTime(event.occurredAt), event: 'Pedestrian detected', triggered: event.triggeredCycle };
}

/**
 * The server-stored pedestrian activity history: the newest rows are loaded on
 * mount and again after each new detection or automatic cycle, so the list
 * survives a reload instead of living only in this browser session.
 */
export function useRecentActivity(
  loadActivity: (limit?: number) => Promise<DetectionActivity[]> = getRecentActivity,
) {
  const rows = ref<DashboardActivityRow[]>([]);
  const failed = ref(false);
  const loading = ref(false);
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  async function refresh() {
    loading.value = true;
    try {
      rows.value = await loadActivity(ACTIVITY_ROW_LIMIT).then((events) => events.map(activityToRow));
      failed.value = false;
    } catch {
      failed.value = true;
    } finally {
      loading.value = false;
    }
  }

  /** A new detection or cycle appeared in the live state; refetch shortly after. */
  function notifyActivity() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { void refresh(); }, ACTIVITY_REFRESH_DEBOUNCE_MS);
  }

  function stop() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  if (getCurrentInstance()) onUnmounted(stop);

  return { rows, failed, loading, refresh, notifyActivity, stop };
}
