import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { adminGuard } from '../../supabaseauth';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

export async function adminSizeTierRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminGuard);

  // GET /api/admin/size-tiers - List all active size tiers
  app.get('/', async (request, reply) => {
    const querySchema = z.object({
      includeInactive: z.coerce.boolean().optional().default(false),
    });

    try {
      const { includeInactive } = querySchema.parse(request.query);
      const tiers = await prisma.printSizeTier.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          label: true,
          widthCm: true,
          heightCm: true,
          sortOrder: true,
          isActive: true,
        },
      });

      return { tiers };
    } catch (error) {
      request.log.error({ error }, 'Failed to fetch size tiers');
      return reply.status(500).send({ error: 'Failed to fetch size tiers' });
    }
  });

  app.post('/', async (request, reply) => {
    const bodySchema = z.object({
      name: z.string().trim().min(1),
      label: z.string().trim().min(1),
      widthCm: z.number().gt(0),
      heightCm: z.number().gt(0),
      sortOrder: z.number().int().optional().default(0),
      isActive: z.boolean().optional().default(true),
    });

    try {
      const body = bodySchema.parse(request.body);
      const tier = await prisma.printSizeTier.create({
        data: {
          name: body.name,
          label: body.label,
          widthCm: body.widthCm,
          heightCm: body.heightCm,
          sortOrder: body.sortOrder,
          isActive: body.isActive,
        },
      });

      return reply.status(201).send({ tier });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return reply.status(409).send({ error: 'Size tier name already exists' });
      }
      request.log.error({ error }, 'Failed to create size tier');
      return reply.status(500).send({ error: 'Failed to create size tier' });
    }
  });

  app.put('/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const bodySchema = z.object({
      name: z.string().trim().min(1).optional(),
      label: z.string().trim().min(1).optional(),
      widthCm: z.number().gt(0).optional(),
      heightCm: z.number().gt(0).optional(),
      sortOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    });

    try {
      const { id } = paramsSchema.parse(request.params);
      const body = bodySchema.parse(request.body);

      const tier = await prisma.printSizeTier.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.label !== undefined ? { label: body.label } : {}),
          ...(body.widthCm !== undefined ? { widthCm: body.widthCm } : {}),
          ...(body.heightCm !== undefined ? { heightCm: body.heightCm } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      });

      return { tier };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return reply.status(409).send({ error: 'Size tier name already exists' });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return reply.status(404).send({ error: 'Size tier not found' });
      }
      request.log.error({ error }, 'Failed to update size tier');
      return reply.status(500).send({ error: 'Failed to update size tier' });
    }
  });

  // Soft-delete (deactivate)
  app.delete('/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });

    try {
      const { id } = paramsSchema.parse(request.params);
      await prisma.printSizeTier.update({
        where: { id },
        data: { isActive: false },
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return reply.status(404).send({ error: 'Size tier not found' });
      }
      request.log.error({ error }, 'Failed to delete size tier');
      return reply.status(500).send({ error: 'Failed to delete size tier' });
    }
  });
}
