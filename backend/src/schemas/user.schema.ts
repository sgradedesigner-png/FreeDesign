import { z } from 'zod';

/**
 * Update Profile Validation Schema
 * Validates user profile update payload
 */
export const updateProfileSchema = z.object({
  fullName: z.string()
    .min(2, 'Full name too short')
    .max(100, 'Full name too long')
    .trim()
    .optional(),
  phone: z.string()
    .regex(/^[0-9]{8}$/, 'Invalid phone number (must be 8 digits)')
    .optional(),
  avatarUrl: z.string()
    .url('Invalid avatar URL')
    .optional()
});

/**
 * Email Validation Schema
 */
export const emailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email too long')
  .toLowerCase()
  .trim();

/**
 * Password Validation Schema
 * Requires: min 8 chars, 1 uppercase, 1 lowercase, 1 number
 */
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Register/Login Schemas
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string()
    .min(2, 'Full name too short')
    .max(100, 'Full name too long')
    .trim()
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password required')
});

/**
 * TypeScript type inference
 */
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
