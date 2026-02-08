// backend/src/routes/admin/orders.ts
import { FastifyInstance } from 'fastify';
import { adminGuard } from '../../supabaseauth';
import { prisma } from '../../lib/prisma';

export default async function adminOrderRoutes(fastify: FastifyInstance) {

  // Get all orders (admin only)
  fastify.get('/admin/orders', {
    preHandler: [adminGuard]
  }, async (request, reply) => {
    const query = request.query as any;
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const status = query.status;

    const where = status ? { status } : {};

    try {
      // No N+1 problem: items are stored as JSON in Order model
      // User data is in Supabase Auth, not Prisma
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.order.count({ where })
      ]);

      return reply.send({
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      console.error('Admin fetch orders error:', error);
      return reply.code(500).send({ error: 'Failed to fetch orders' });
    }
  });

  // Get specific order details (admin)
  fastify.get('/admin/orders/:id', {
    preHandler: [adminGuard]
  }, async (request, reply) => {
    const { id } = request.params as any;

    try {
      // No N+1 problem: items are stored as JSON in Order model
      const order = await prisma.order.findUnique({
        where: { id }
      });

      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      return reply.send({ order });
    } catch (error: any) {
      console.error('Admin fetch order error:', error);
      return reply.code(500).send({ error: 'Failed to fetch order' });
    }
  });

  // Update order status
  fastify.put('/admin/orders/:id', {
    preHandler: [adminGuard]
  }, async (request, reply) => {
    const { id } = request.params as any;
    const { status } = request.body as any;

    // Validate status
    const validStatuses = ['PENDING', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return reply.code(400).send({ error: 'Invalid status' });
    }

    try {
      const order = await prisma.order.update({
        where: { id },
        data: { status }
      });

      console.log(`✅ Order ${id} status updated to ${status}`);

      return reply.send({ order });
    } catch (error: any) {
      console.error('Update order error:', error);
      return reply.code(500).send({ error: 'Failed to update order' });
    }
  });
}
