import { z } from 'zod';

export const placementConfigSchema = z.object({
  offsetX: z.number().finite().optional(),
  offsetY: z.number().finite().optional(),
  rotation: z.number().finite().optional(),
  scale: z.number().positive().finite().optional(),
});

export const normalizedRectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
});

export const mockupPreviewSchema = z.object({
  variantId: z.string().uuid('Invalid variantId'),
  printAreaId: z.string().uuid('Invalid printAreaId'),
  printSizeTierId: z.string().uuid('Invalid printSizeTierId').optional(),
  assetId: z.string().uuid('Invalid assetId'),
  baseImageUrl: z.string().trim().min(1).optional(),
  presetRectNorm: normalizedRectSchema.optional(),
  baseImageNaturalWidth: z.number().int().positive().optional(),
  baseImageNaturalHeight: z.number().int().positive().optional(),
  placementConfig: placementConfigSchema.optional(),
});

export const quoteCustomizationSchema = z.object({
  printAreaId: z.string().uuid('Invalid printAreaId'),
  printSizeTierId: z.string().uuid('Invalid printSizeTierId'),
});

export const priceQuoteSchema = z.object({
  variantId: z.string().uuid('Invalid variantId'),
  customizations: z.array(quoteCustomizationSchema)
    .min(1, 'At least one customization is required')
    .max(10, 'Too many customizations'),
  addOnIds: z.array(z.string().uuid('Invalid addOnId'))
    .max(20, 'Too many add-ons')
    .optional()
    .default([]),
  quantity: z.number()
    .int('Quantity must be integer')
    .positive('Quantity must be positive')
    .max(1000, 'Quantity too large'),
  rushOrder: z.boolean().optional().default(false),
}).superRefine((data, ctx) => {
  const areaIds = data.customizations.map((item) => item.printAreaId);
  const uniqueAreaIds = new Set(areaIds);

  if (uniqueAreaIds.size !== areaIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Each print area can only be configured once',
      path: ['customizations'],
    });
  }

  const addOnIds = data.addOnIds ?? [];
  if (new Set(addOnIds).size !== addOnIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Duplicate add-on is not allowed',
      path: ['addOnIds'],
    });
  }
});

export type PlacementConfigInput = z.infer<typeof placementConfigSchema>;
export type QuoteCustomizationInput = z.infer<typeof quoteCustomizationSchema>;
export type PriceQuoteInput = z.infer<typeof priceQuoteSchema>;
export type MockupPreviewInput = z.infer<typeof mockupPreviewSchema>;
