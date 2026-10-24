import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDetectionActivityService, type ActivityRepository } from './detectionActivity.service.js';
import type { DetectionActivity } from '../entities/DetectionActivity.js';

function row(overrides: Partial<DetectionActivity> = {}): DetectionActivity {
  return {
    id: 'activity-1',
    occurredAt: new Date('2026-10-24T09:00:00.000Z'),
    peopleCount: 2,
    triggeredCycle: false,
    ...overrides,
  };
}

function repoMock(): ActivityRepository & {
  create: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  createQueryBuilder: ReturnType<typeof vi.fn>;
} {
  const createQueryBuilder = vi.fn();
  return {
    create: vi.fn().mockImplementation((data) => ({ ...row(), ...data })),
    save: vi.fn().mockImplementation(async (entity: DetectionActivity) => entity),
    update: vi.fn(),
    find: vi.fn(),
    createQueryBuilder,
  };
}

let repo: ReturnType<typeof repoMock>;

beforeEach(() => {
  vi.clearAllMocks();
  repo = repoMock();
});

describe('detectionActivity service', () => {
  it('records a detection and remembers its row as the current activity', async () => {
    const { recordDetection, markCycleTriggered } = createDetectionActivityService(() => repo);

    const saved = await recordDetection(2);

    expect(repo.create).toHaveBeenCalledWith({ peopleCount: 2 });
    expect(saved.id).toBe('activity-1');
    expect(saved.peopleCount).toBe(2);

    // The automatic cycle that follows marks the current row as triggered.
    await markCycleTriggered();
    expect(repo.update).toHaveBeenCalledWith('activity-1', { triggeredCycle: true });
  });

  it('does not mark a cycle trigger when no detection was recorded before it', async () => {
    const { markCycleTriggered } = createDetectionActivityService(() => repo);

    await markCycleTriggered();

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('lists the newest rows first', async () => {
    repo.find.mockResolvedValue([row(), row({ id: 'activity-0' })]);
    const { listRecent } = createDetectionActivityService(() => repo);

    const items = await listRecent(5);

    expect(repo.find).toHaveBeenCalledWith({ order: { occurredAt: 'DESC' }, take: 5 });
    expect(items).toHaveLength(2);
  });

  it('deletes the rows older than 30 days', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T12:00:00.000Z'));
    const execute = vi.fn().mockResolvedValue({ affected: 1 });
    let capturedCutoff: Date | null = null;
    repo.createQueryBuilder.mockImplementation(() => ({
      delete: () => ({
        where: (_condition: string, params: { cutoff: Date }) => {
          capturedCutoff = params.cutoff;
          return { execute };
        },
      }),
    }));
    const { prune } = createDetectionActivityService(() => repo);

    await prune();

    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);
    // 30 days back from now: rows with occurred_at before that cutoff go away.
    expect(capturedCutoff?.toISOString()).toBe('2026-09-24T12:00:00.000Z');
    vi.useRealTimers();
  });

  it('prunes at most once per hour from recordDetection', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T12:00:00.000Z'));
    const execute = vi.fn().mockResolvedValue({ affected: 0 });
    repo.createQueryBuilder.mockImplementation(() => ({
      delete: () => ({
        where: () => ({ execute }),
      }),
    }));
    const { recordDetection } = createDetectionActivityService(() => repo);

    await recordDetection(1);
    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);

    // Ten minutes later: still within the prune window, so no prune query.
    vi.advanceTimersByTime(10 * 60 * 1000);
    await recordDetection(1);
    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);

    // An hour later: the next detection prunes again.
    vi.advanceTimersByTime(60 * 60 * 1000);
    await recordDetection(1);
    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
