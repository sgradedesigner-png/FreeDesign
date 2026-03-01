import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { adminGuard } from '../../supabaseauth';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

export async function adminPrintAreaRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminGuard);

  // GET /api/admin/print-areas - List all active print areas
  app.get('/', async (request, reply) => {
    const querySchema = z.object({
      includeInactive: z.coerce.boolean().optional().default(false),
    });

    try {
      const { includeInactive } = querySchema.parse(request.query);
      const areas = await prisma.printArea.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          label: true,
          labelEn: true,
          maxWidthCm: true,
          maxHeightCm: true,
          sortOrder: true,
          isActive: true,
        },
      });

      return { areas };
    } catch (error) {
      request.log.error({ error }, 'Failed to fetch print areas');
      return reply.status(500).send({ error: 'Failed to fetch print areas' });
    }
  });

  app.post('/', async (request, reply) => {
    const bodySchema = z.object({
      name: z.string().trim().min(1),
      label: z.string().trim().min(1),
      labelEn: z.string().trim().min(1).optional().nullable(),
      maxWidthCm: z.number().gt(0),
      maxHeightCm: z.number().gt(0),
      sortOrder: z.number().int().optional().default(0),
      isActive: z.boolean().optional().default(true),
    });

    try {
      const body = bodySchema.parse(request.body);
      const area = await prisma.printArea.create({
        data: {
          name: body.name,
          label: body.label,
          labelEn: body.labelEn ?? null,
          maxWidthCm: body.maxWidthCm,
          maxHeightCm: body.maxHeightCm,
          sortOrder: body.sortOrder,
          isActive: body.isActive,
        },
      });

      return reply.status(201).send({ area });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return reply.status(409).send({ error: 'Print area name already exists' });
      }
      request.log.error({ error }, 'Failed to create print area');
      return reply.status(500).send({ error: 'Failed to create print area' });
    }
  });

  app.put('/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const bodySchema = z.object({
      name: z.string().trim().min(1).optional(),
      label: z.string().trim().min(1).optional(),
      labelEn: z.string().trim().min(1).nullable().optional(),
      maxWidthCm: z.number().gt(0).optional(),
      maxHeightCm: z.number().gt(0).optional(),
      sortOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    });

    try {
      const { id } = paramsSchema.parse(request.params);
      const body = bodySchema.parse(request.body);

      const area = await prisma.printArea.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.label !== undefined ? { label: body.label } : {}),
          ...(body.labelEn !== undefined ? { labelEn: body.labelEn } : {}),
          ...(body.maxWidthCm !== undefined ? { maxWidthCm: body.maxWidthCm } : {}),
          ...(body.maxHeightCm !== undefined ? { maxHeightCm: body.maxHeightCm } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      });

      return { area };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return reply.status(409).send({ error: 'Print area name already exists' });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return reply.status(404).send({ error: 'Print area not found' });
      }
      request.log.error({ error }, 'Failed to update print area');
      return reply.status(500).send({ error: 'Failed to update print area' });
    }
  });

  // Soft-delete (deactivate)
  app.delete('/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });

    try {
      const { id } = paramsSchema.parse(request.params);
      await prisma.printArea.update({
        where: { id },
        data: { isActive: false },
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return reply.status(404).send({ error: 'Print area not found' });
      }
      request.log.error({ error }, 'Failed to delete print area');
      return reply.status(500).send({ error: 'Failed to delete print area' });
    }
  });
}
