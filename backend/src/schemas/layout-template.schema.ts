import { z } from 'zod';

export const layoutRectNormSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().gt(0).max(1),
  h: z.number().gt(0).max(1),
}).superRefine((value, ctx) => {
  if (value.x + value.w > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['w'],
      message: 'x + w must be <= 1',
    });
  }
  if (value.y + value.h > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['h'],
      message: 'y + h must be <= 1',
    });
  }
});

const layoutViewSchema = z.object({
  imagePath: z.string().optional(),
  naturalWidth: z.number().int().positive().optional(),
  naturalHeight: z.number().int().positive().optional(),
});

export const customizationTemplateV1Schema = z.object({
  version: z.literal(1),
  views: z.object({
    front: layoutViewSchema.optional(),
    back: layoutViewSchema.optional(),
    left: layoutViewSchema.optional(),
    right: layoutViewSchema.optional(),
  }).default({}),
  presets: z.array(z.object({
    id: z.string().optional(),
    key: z.string().min(1),
    labelMn: z.string().optional(),
    labelEn: z.string().optional(),
    view: z.enum(['front', 'back', 'left', 'right']),
    rectNorm: layoutRectNormSchema,
    printAreaId: z.string().uuid().nullable().optional(),
    sortOrder: z.number().int().optional().default(0),
    isDefault: z.boolean().optional().default(false),
  })).default([]),
}).superRefine((template, ctx) => {
  const defaultCountByView = new Map<string, number>();

  template.presets.forEach((preset, index) => {
    if (!preset.printAreaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['presets', index, 'printAreaId'],
        message: 'Each preset must be linked to a print area',
      });
    }

    if (preset.isDefault) {
      defaultCountByView.set(
        preset.view,
        (defaultCountByView.get(preset.view) ?? 0) + 1
      );
    }
  });

  defaultCountByView.forEach((count, view) => {
    if (count > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['presets'],
        message: `Only one default preset is allowed for view "${view}"`,
      });
    }
  });
});

export type CustomizationTemplateV1Input = z.infer<typeof customizationTemplateV1Schema>;

export function collectTemplatePrintAreaIds(template: CustomizationTemplateV1Input | null | undefined): string[] {
  if (!template) return [];
  return Array.from(
    new Set(
      template.presets
        .map((preset) => preset.printAreaId)
        .filter((value): value is string => Boolean(value))
    )
  );
}

