import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { adminGuard } from '../../supabaseauth';
import { prisma } from '../../lib/prisma';

const layoutRectNormSchema = z.object({
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

const customizationTemplateV1Schema = z.object({
  version: z.literal(1),
  views: z.object({
    front: z.object({
      imagePath: z.string().optional(),
      naturalWidth: z.number().int().positive().optional(),
      naturalHeight: z.number().int().positive().optional(),
    }).optional(),
    back: z.object({
      imagePath: z.string().optional(),
      naturalWidth: z.number().int().positive().optional(),
      naturalHeight: z.number().int().positive().optional(),
    }).optional(),
    left: z.object({
      imagePath: z.string().optional(),
      naturalWidth: z.number().int().positive().optional(),
      naturalHeight: z.number().int().positive().optional(),
    }).optional(),
    right: z.object({
      imagePath: z.string().optional(),
      naturalWidth: z.number().int().positive().optional(),
      naturalHeight: z.number().int().positive().optional(),
    }).optional(),
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
});

export async function adminLayoutTemplateRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminGuard);

  app.get('/:id/layout-template', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      select: { id: true, metadata: true },
    });

    if (!product) {
      return reply.status(404).send({ message: 'Product not found' });
    }

    const metadata = (product.metadata && typeof product.metadata === 'object'
      ? (product.metadata as Prisma.JsonObject)
      : {}) as Prisma.JsonObject;

    return {
      productId: product.id,
      customizationTemplateV1: metadata.customizationTemplateV1 ?? null,
    };
  });

  app.put('/:id/layout-template', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      customizationTemplateV1: customizationTemplateV1Schema.nullable(),
    }).parse(request.body);

    const existing = await prisma.product.findUnique({
      where: { id: params.id },
      select: { id: true, metadata: true },
    });

    if (!existing) {
      return reply.status(404).send({ message: 'Product not found' });
    }

    const metadata = (existing.metadata && typeof existing.metadata === 'object'
      ? { ...(existing.metadata as Prisma.JsonObject) }
      : {}) as Prisma.JsonObject;

    if (body.customizationTemplateV1 === null) {
      delete metadata.customizationTemplateV1;
    } else {
      metadata.customizationTemplateV1 = body.customizationTemplateV1 as unknown as Prisma.JsonValue;
    }

    const updated = await prisma.product.update({
      where: { id: params.id },
      data: { metadata },
      select: { id: true, metadata: true, updatedAt: true },
    });

    return {
      productId: updated.id,
      customizationTemplateV1: (updated.metadata as Prisma.JsonObject).customizationTemplateV1 ?? null,
      updatedAt: updated.updatedAt,
    };
  });
}
