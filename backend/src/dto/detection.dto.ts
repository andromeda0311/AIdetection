import { z } from 'zod';

export const detectionIdParams = z.object({
  id: z.string({ required_error: 'Detection id is required.' }).uuid('Detection id must be a valid UUID.'),
});

export const frameIdParams = z.object({
  frameId: z.string({ required_error: 'Frame id is required.' }).uuid('Frame id must be a valid UUID.'),
});

export const listDetectionsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
