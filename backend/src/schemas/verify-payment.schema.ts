import { z } from 'zod';

/**
 * Verify Payment Request Schema
 * Validates manual payment verification request
 */
export const verifyPaymentSchema = z.object({
  orderId: z.string()
    .uuid('Invalid order ID format')
});

/**
 * TypeScript type inference
 */
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
