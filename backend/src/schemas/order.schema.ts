import { z } from 'zod';
import { placementConfigSchema } from './customization.schema';

export const orderItemCustomizationSchema = z.object({
  printAreaId: z.string().uuid('Invalid printAreaId'),
  printSizeTierId: z.string().uuid('Invalid printSizeTierId'),
  assetId: z.string().uuid('Invalid assetId'),
  printFee: z.number()
    .min(0, 'printFee cannot be negative')
    .finite('printFee must be finite'),
  placementConfig: placementConfigSchema.optional(),
});

export const orderItemAddOnSchema = z.object({
  id: z.string().uuid('Invalid add-on rule id'),
  name: z.string().min(1, 'Add-on name is required'),
  fee: z.number()
    .min(0, 'Add-on fee cannot be negative')
    .finite('Add-on fee must be finite'),
});

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
  // Accept either 'price' or 'variantPrice' from frontend
  price: z.number()
    .positive('Price must be positive')
    .finite('Price must be finite')
    .optional(),
  variantPrice: z.number()
    .positive('Price must be positive')
    .finite('Price must be finite')
    .optional(),
  // Optional fields from frontend for order snapshot
  productName: z.string().optional(),
  variantName: z.string().optional(),
  imagePath: z.string().optional(),
  addOns: z.array(orderItemAddOnSchema)
    .max(20, 'Too many add-ons for one item')
    .optional(),
  customizations: z.array(orderItemCustomizationSchema)
    .max(10, 'Too many customizations for one item')
    .optional(),
  // P3-04: Builder project reference (only for GANG_BUILDER items)
  builderProjectId: z.string().uuid('Invalid builderProjectId').optional(),
}).refine(
  (data) => data.price !== undefined || data.variantPrice !== undefined,
  {
    message: 'Either price or variantPrice must be provided',
    path: ['price']
  }
).refine(
  (data) => {
    const customizations = data.customizations ?? [];
    const areaIds = customizations.map((item) => item.printAreaId);
    return new Set(areaIds).size === areaIds.length;
  },
  {
    message: 'Duplicate printAreaId is not allowed within the same order item',
    path: ['customizations']
  }
);

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
  address: z.string()
    .min(5, 'Хаяг хэт богино байна (доод тал нь 5 тэмдэгт шаардлагатай)')
    .max(500, 'Хаяг хэт урт байна')
    .trim(),
  // Make city and district optional with empty string handling
  city: z.string()
    .transform(val => val?.trim() || 'Ulaanbaatar')
    .optional()
    .default('Ulaanbaatar'),
  district: z.string()
    .transform(val => val?.trim() || '')
    .optional()
    .default(''),
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
  rushOrder: z.boolean().optional().default(false),
  rushFee: z.number()
    .min(0, 'rushFee cannot be negative')
    .finite('rushFee must be finite')
    .optional()
    .default(0),
  addOnFees: z.number()
    .min(0, 'addOnFees cannot be negative')
    .finite('addOnFees must be finite')
    .optional()
    .default(0),
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
