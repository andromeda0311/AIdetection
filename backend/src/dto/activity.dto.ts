import { z } from 'zod';

/** ?limit for GET /activity/recent: the dashboard shows the 5 most recent rows (1-50). */
export const recentActivityQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

export type RecentActivityQuery = z.infer<typeof recentActivityQuery>;
