import { z } from 'zod';
import { ROLES } from '../types/authUser.js';

export const createStaffSchema = z.object({
  email: z.string({ required_error: 'Email is required.' }).email('A valid email is required.'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(8, 'Password must be at least 8 characters long.'),
  firstName: z.string().trim().min(1, 'First name is required.').max(100),
  lastName: z.string().trim().min(1, 'Last name is required.').max(100),
  role: z.enum(ROLES).default('staff'),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name cannot be empty.').max(100).optional(),
    lastName: z.string().trim().min(1, 'Last name cannot be empty.').max(100).optional(),
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided.',
  });

export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const staffIdParams = z.object({
  id: z.string({ required_error: 'Staff id is required.' }).uuid('Staff id must be a valid UUID.'),
});
