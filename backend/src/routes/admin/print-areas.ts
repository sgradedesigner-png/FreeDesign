import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { adminGuard } from '../../supabaseauth';

export async function adminPrintAreaRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminGuard);

  // GET /api/admin/print-areas - List all active print areas
  app.get('/', async (request, reply) => {
    try {
      const areas = await prisma.printArea.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          label: true,
          maxWidthCm: true,
          maxHeightCm: true,
          sortOrder: true,
        },
      });

      return { areas };
    } catch (error) {
      request.log.error({ error }, 'Failed to fetch print areas');
      return reply.status(500).send({ error: 'Failed to fetch print areas' });
    }
  });
}
