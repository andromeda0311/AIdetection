import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .email('A valid email is required.')
    .transform((value) => value.toLowerCase().trim()),
  password: z.string({ required_error: 'Password is required.' }).min(1, 'Password is required.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    firstName: z
      .string({ required_error: 'First name is required.' })
      .trim()
      .min(1, 'First name is required.')
      .max(100, 'First name must be at most 100 characters.'),
    lastName: z
      .string({ required_error: 'Last name is required.' })
      .trim()
      .min(1, 'Last name is required.')
      .max(100, 'Last name must be at most 100 characters.'),
    email: z
      .string({ required_error: 'Email is required.' })
      .email('A valid email is required.')
      .transform((value) => value.toLowerCase().trim()),
    password: z
      .string({ required_error: 'Password is required.' })
      .min(8, 'Password must be at least 8 characters long.')
      .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
      .regex(/[0-9]/, 'Password must contain at least one number.'),
    confirmPassword: z.string({ required_error: 'Password confirmation is required.' }),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
