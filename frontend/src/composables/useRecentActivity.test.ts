import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ACTIVITY_ROW_LIMIT, activityToRow, formatActivityTime, useRecentActivity } from './useRecentActivity';
import type { DetectionActivity } from '../types';

const api = vi.hoisted(() => ({
  getRecentActivity: vi.fn(),
}));

vi.mock('../api', () => ({ getRecentActivity: api.getRecentActivity }));

function storedEvent(overrides: Partial<DetectionActivity> = {}): DetectionActivity {
  return { id: 'row-1', occurredAt: '2026-10-24T15:24:12.000Z', peopleCount: 2, triggeredCycle: true, ...overrides };
}

describe('useRecentActivity', () => {
  beforeEach(() => {
    api.getRecentActivity.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it('loads the 5 most recent rows from the API on mount (refresh)', async () => {
    api.getRecentActivity.mockResolvedValue([storedEvent()]);
    const activity = useRecentActivity(api.getRecentActivity);

    await activity.refresh();

    expect(api.getRecentActivity).toHaveBeenCalledWith(ACTIVITY_ROW_LIMIT);
    expect(api.getRecentActivity).toHaveBeenCalledTimes(1);
    expect(activity.rows.value).toEqual([{ id: 'row-1', time: formatActivityTime('2026-10-24T15:24:12.000Z'), event: 'Pedestrian detected', triggered: true }]);
    expect(activity.failed.value).toBe(false);
  });

  it('shows an unavailable state instead of fake rows when loading fails', async () => {
    api.getRecentActivity.mockRejectedValue(new Error('network down'));
    const activity = useRecentActivity(api.getRecentActivity);

    await activity.refresh();

    expect(activity.rows.value).toEqual([]);
    expect(activity.failed.value).toBe(true);
  });

  it('refetches once when a new detection or cycle appears (debounced)', async () => {
    vi.useFakeTimers();
    api.getRecentActivity.mockResolvedValue([storedEvent()]);
    const activity = useRecentActivity(api.getRecentActivity);
    await activity.refresh();
    api.getRecentActivity.mockClear();

    activity.notifyActivity();
    activity.notifyActivity();
    activity.notifyActivity();

    expect(api.getRecentActivity).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(api.getRecentActivity).toHaveBeenCalledTimes(1);

    activity.stop();
  });
});

describe('activityToRow', () => {
  it('formats the stored time as a 12-hour clock and keeps the cycle trigger', () => {
    const view = activityToRow(storedEvent());
    expect(view.time).toMatch(/\d{2}:\d{2}:\d{2} [AP]M/);
    expect(view.event).toBe('Pedestrian detected');
    expect(view.triggered).toBe(true);

    const idle = activityToRow(storedEvent({ triggeredCycle: false }));
    expect(idle.triggered).toBe(false);
  });
});
