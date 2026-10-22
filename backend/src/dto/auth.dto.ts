import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .max(254, 'Email is too long.')
    .email('A valid email is required.')
    .transform((value) => value.toLowerCase().trim()),
  // Upper bound stops very large bodies from being hashed (bcrypt only uses 72 bytes anyway).
  password: z.string({ required_error: 'Password is required.' }).min(1, 'Password is required.').max(128, 'Password is too long.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
