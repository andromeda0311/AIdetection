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

/** Live person detections reported by a logged-in dashboard (browser webcam). Boxes are 0..1 of the frame. */
export const liveDetectionBody = z
  .object({
    /** Random ID of the reporting browser tab; only one station may feed the lights at a time. */
    stationId: z.string().min(8).max(64),
    count: z.number().int().min(0).max(200),
    frameWidth: z.number().int().min(0).max(10_000),
    frameHeight: z.number().int().min(0).max(10_000),
    boxes: z
      .array(
        z.object({
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
          width: z.number().min(0).max(1),
          height: z.number().min(0).max(1),
          score: z.number().min(0).max(1),
        }),
      )
      .max(200),
  })
  .refine((body) => body.boxes.length === body.count, { message: 'count must equal the number of boxes.', path: ['count'] });

export type LiveDetectionBody = z.infer<typeof liveDetectionBody>;

/** Payload from the Python YOLO service (machine ingest). Extra fields are kept. */
export const yoloDetectionBody = z
  .object({
    timestamp: z.number(),
    detected: z.boolean(),
    count: z.number().int().min(0),
    detections: z.array(
      z
        .object({
          class: z.string(),
          confidence: z.number(),
          x1: z.number(),
          y1: z.number(),
          x2: z.number(),
          y2: z.number(),
        })
        .passthrough(),
    ),
  })
  .passthrough();
