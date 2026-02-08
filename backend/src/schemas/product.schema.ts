import { z } from 'zod';

/**
 * Create Product Validation Schema
 * Validates product creation payload
 */
export const createProductSchema = z.object({
  name: z.string()
    .min(2, 'Product name too short')
    .max(200, 'Product name too long')
    .trim(),
  description: z.string()
    .min(10, 'Description too short')
    .max(5000, 'Description too long')
    .trim(),
  price: z.number()
    .positive('Price must be positive')
    .finite('Price must be finite'),
  categoryId: z.string()
    .uuid('Invalid category ID'),
  stock: z.number()
    .int('Stock must be integer')
    .min(0, 'Stock cannot be negative'),
  images: z.array(z.string().url('Invalid image URL'))
    .min(1, 'At least one image required')
    .max(10, 'Too many images (max 10)'),
  specifications: z.record(z.string(), z.string())
    .optional()
});

/**
 * Update Product Validation Schema
 * All fields are optional for updates
 */
export const updateProductSchema = createProductSchema.partial();

/**
 * Product Query Params Schema
 * Validates query parameters for product filtering
 */
export const productQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  search: z.string().max(200).optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0)
});

/**
 * TypeScript type inference
 */
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryParams = z.infer<typeof productQuerySchema>;
