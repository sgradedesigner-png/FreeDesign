import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { adminGuard } from '../../supabaseauth';
import { prisma } from '../../lib/prisma';
import {
  collectTemplatePrintAreaIds,
  customizationTemplateV1Schema,
} from '../../schemas/layout-template.schema';

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
      select: {
        id: true,
        metadata: true,
        printAreas: { select: { printAreaId: true } },
      },
    });

    if (!existing) {
      return reply.status(404).send({ message: 'Product not found' });
    }

    const metadata = (existing.metadata && typeof existing.metadata === 'object'
      ? { ...(existing.metadata as Prisma.JsonObject) }
      : {}) as Prisma.JsonObject;

    if (body.customizationTemplateV1 !== null) {
      const linkedAreaIds = collectTemplatePrintAreaIds(body.customizationTemplateV1);
      if (linkedAreaIds.length > 0) {
        const [activeCount, enabledAreaIds] = await Promise.all([
          prisma.printArea.count({
            where: {
              id: { in: linkedAreaIds },
              isActive: true,
            },
          }),
          Promise.resolve(new Set(existing.printAreas.map((item) => item.printAreaId))),
        ]);
        if (activeCount !== linkedAreaIds.length) {
          return reply.status(400).send({
            message: 'Template presets reference invalid/inactive print areas',
          });
        }
        const hasOutOfScope = linkedAreaIds.some((id) => !enabledAreaIds.has(id));
        if (hasOutOfScope) {
          return reply.status(400).send({
            message: 'Template preset printAreaId must be enabled for this product',
          });
        }
      }
    }

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
