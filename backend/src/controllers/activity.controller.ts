import type { Request, Response } from 'express';
import { listRecent } from '../services/detectionActivity.service.js';
import { sendSuccess } from '../utils/response.js';
import type { RecentActivityQuery } from '../dto/activity.dto.js';

export async function listRecentActivity(req: Request, res: Response): Promise<Response> {
  const { limit } = req.validatedQuery as RecentActivityQuery;
  const rows = await listRecent(limit);
  return sendSuccess(res, 200, 'Recent detection activity.', {
    items: rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      peopleCount: row.peopleCount,
      triggeredCycle: row.triggeredCycle,
    })),
  });
}
