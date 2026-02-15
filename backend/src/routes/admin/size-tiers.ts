import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { adminGuard } from '../../supabaseauth';

export async function adminSizeTierRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminGuard);

  // GET /api/admin/size-tiers - List all active size tiers
  app.get('/', async (request, reply) => {
    try {
      const tiers = await prisma.printSizeTier.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          label: true,
          widthCm: true,
          heightCm: true,
          sortOrder: true,
        },
      });

      return { tiers };
    } catch (error) {
      request.log.error({ error }, 'Failed to fetch size tiers');
      return reply.status(500).send({ error: 'Failed to fetch size tiers' });
    }
  });
}
