import { z } from 'zod';

/**
 * Order Item Validation Schema
 * Validates individual items in an order
 */
export const createOrderItemSchema = z.object({
  id: z.string().uuid('Invalid product ID'),
  quantity: z.number()
    .int('Quantity must be integer')
    .positive('Quantity must be positive')
    .max(100, 'Max quantity is 100'),
  price: z.number()
    .positive('Price must be positive')
    .finite('Price must be finite')
});

/**
 * Shipping Address Validation Schema
 * Validates shipping address information
 */
export const shippingAddressSchema = z.object({
  fullName: z.string()
    .min(2, 'Name too short')
    .max(100, 'Name too long')
    .trim(),
  phone: z.string()
    .regex(/^[0-9]{8}$/, 'Invalid phone number (must be 8 digits)'),
  city: z.string()
    .min(2, 'City name too short')
    .max(100, 'City name too long')
    .trim(),
  district: z.string()
    .min(2, 'District name too short')
    .max(100, 'District name too long')
    .trim(),
  address: z.string()
    .min(5, 'Address too short')
    .max(500, 'Address too long')
    .trim(),
  zipCode: z.string()
    .optional()
    .transform(val => val?.trim())
});

/**
 * Create Order Validation Schema
 * Validates the entire order creation payload
 */
export const createOrderSchema = z.object({
  items: z.array(createOrderItemSchema)
    .min(1, 'At least one item required')
    .max(50, 'Too many items (max 50)'),
  shippingAddress: shippingAddressSchema,
  total: z.number()
    .positive('Total must be positive')
    .finite('Total must be finite')
    .max(100000000, 'Total too large')
});

/**
 * TypeScript type inference from schema
 */
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreateOrderItem = z.infer<typeof createOrderItemSchema>;
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;
