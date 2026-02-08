import { z } from 'zod';

/**
 * QPay Webhook Validation Schema
 * Validates QPay payment callback payload
 */
export const qpayWebhookSchema = z.object({
  payment_id: z.string()
    .min(1, 'payment_id is required')
    .optional(),
  paymentId: z.string()
    .min(1, 'paymentId is required')
    .optional(),
  invoice_id: z.string()
    .optional(),
  invoiceId: z.string()
    .optional(),
  order_id: z.string()
    .optional(),
  orderId: z.string()
    .optional(),
  sender_invoice_no: z.string()
    .optional(),
  payment_status: z.string()
    .optional(),
  payment_amount: z.number()
    .positive()
    .optional(),
  payment_date: z.string()
    .optional()
}).refine(
  (data) => data.payment_id || data.paymentId,
  { message: 'Either payment_id or paymentId is required' }
);

/**
 * Order ID Param Validation
 */
export const orderIdParamSchema = z.object({
  id: z.string()
    .uuid('Invalid order ID format')
});

/**
 * Payment Status Query Validation
 */
export const paymentStatusQuerySchema = z.object({
  invoiceId: z.string()
    .optional()
});

/**
 * TypeScript type inference
 */
export type QPayWebhookInput = z.infer<typeof qpayWebhookSchema>;
export type OrderIdParam = z.infer<typeof orderIdParamSchema>;
export type PaymentStatusQuery = z.infer<typeof paymentStatusQuerySchema>;
