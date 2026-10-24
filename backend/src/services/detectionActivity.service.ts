import type { Repository } from 'typeorm';
import { AppDataSource } from '../config/ormconfig.js';
import { DetectionActivity } from '../entities/DetectionActivity.js';
import { logger } from '../utils/logger.js';

/** Rows older than 30 days are not useful for the dashboard and are pruned. */
const PRUNE_AFTER_DAYS = 30;
/** The prune query is cheap but the table can be busy; run it at most once an hour. */
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;

/** The parts of the TypeORM repository the service needs (tests pass a stand-in). */
export type ActivityRepository = Pick<
  Repository<DetectionActivity>,
  'create' | 'save' | 'update' | 'find' | 'createQueryBuilder'
>;

/**
 * Lasting detection history: one row per pedestrian appearance, marked as
 * cycle-triggered when the automatic cycle that followed starts. All DB calls
 * stay fire-and-forget from the engine (see yoloLive.instance.ts): they are
 * never awaited in the light's timing path and failures only log.
 */
export function createDetectionActivityService(getRepo: () => ActivityRepository) {
  /** Id of the most recent detection row, so the cycle that follows can mark it triggered. */
  let currentActivityId: string | null = null;
  let lastPrunedAt = 0;

  /** Records a pedestrian appearing in front of the camera. */
  async function recordDetection(peopleCount: number): Promise<DetectionActivity> {
    const entity = getRepo().create({ peopleCount });
    const saved = await getRepo().save(entity);
    currentActivityId = saved.id;
    await maybePrune();
    return saved;
  }

  /** Marks the current detection row as one that triggered an automatic traffic-light cycle. */
  async function markCycleTriggered(): Promise<void> {
    if (currentActivityId === null) return;
    await getRepo().update(currentActivityId, { triggeredCycle: true });
  }

  /** The newest rows first, for the dashboard's Recent Detection Activity list. */
  async function listRecent(limit: number): Promise<DetectionActivity[]> {
    return getRepo().find({ order: { occurredAt: 'DESC' }, take: limit });
  }

  async function prune(): Promise<void> {
    const cutoff = new Date(Date.now() - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    await getRepo().createQueryBuilder('activity').delete().where('occurred_at < :cutoff', { cutoff }).execute();
  }

  /** Called from recordDetection; at most once per hour (old rows are not urgent). */
  async function maybePrune(): Promise<void> {
    const now = Date.now();
    if (now - lastPrunedAt < PRUNE_INTERVAL_MS) return;
    lastPrunedAt = now;
    try {
      await prune();
    } catch (err) {
      // Pruning that fails must never break a detection write.
      logger.error({ err }, 'Failed to prune detection activity');
    }
  }

  return { recordDetection, markCycleTriggered, listRecent, prune };
}

const repository = (): ActivityRepository => AppDataSource.getRepository(DetectionActivity);

/** The single live instance wired to the engine via yoloLive.instance.ts. */
const activityService = createDetectionActivityService(repository);

export const recordDetection = activityService.recordDetection;
export const markCycleTriggered = activityService.markCycleTriggered;
export const listRecent = activityService.listRecent;
export const prune = activityService.prune;
