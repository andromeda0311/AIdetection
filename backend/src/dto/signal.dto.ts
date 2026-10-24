import { z } from 'zod';

/**
 * Automatic-cycle timings of the live traffic-light engine, in milliseconds.
 * Any subset may be sent; values apply from the next cycle.
 */
export const updateSignalConfigSchema = z
  .object({
    detectionThresholdMs: z
      .number({ required_error: 'Detection time is required.' })
      .int('Detection time must be a whole number of milliseconds.')
      .min(1000, 'Detection time must be between 1000 and 60000 milliseconds.')
      .max(60000, 'Detection time must be between 1000 and 60000 milliseconds.')
      .optional(),
    yellowMs: z
      .number({ required_error: 'Warning light time is required.' })
      .int('Warning light time must be a whole number of milliseconds.')
      .min(1000, 'Warning light time must be between 1000 and 60000 milliseconds.')
      .max(60000, 'Warning light time must be between 1000 and 60000 milliseconds.')
      .optional(),
    redMs: z
      .number({ required_error: 'Red light time is required.' })
      .int('Red light time must be a whole number of milliseconds.')
      .min(5000, 'Red light time must be between 5000 and 300000 milliseconds.')
      .max(300000, 'Red light time must be between 5000 and 300000 milliseconds.')
      .optional(),
  })
  .refine((timings) => Object.values(timings).some((value) => value !== undefined), {
    message: 'Provide at least one timing value.',
  });

export type UpdateSignalConfigInput = z.infer<typeof updateSignalConfigSchema>;
