// backend/src/routes/orders.ts
import { FastifyInstance } from 'fastify';
import { userGuard } from '../middleware/userGuard';
import { prisma } from '../lib/prisma';

export default async function orderRoutes(fastify: FastifyInstance) {

  // Create new order (authenticated customers only)
  fastify.post('/api/orders', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = (request as any).user.id;
    const { items, shippingAddress, total } = request.body as any;

    try {
      // Validate request body
      if (!items || !Array.isArray(items) || items.length === 0) {
        return reply.code(400).send({ error: 'Items are required' });
      }

      if (!total || total <= 0) {
        return reply.code(400).send({ error: 'Invalid total amount' });
      }

      // Create order in database
      const order = await prisma.order.create({
        data: {
          userId,
          total,
          status: 'PENDING',
          shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
          items: items, // Prisma will handle JSON serialization
        }
      });

      console.log(`✅ Order created: ${order.id} for user ${userId}`);

      return reply.code(201).send({ order });
    } catch (error: any) {
      console.error('Order creation error:', error);
      return reply.code(500).send({
        error: 'Failed to create order',
        details: error.message
      });
    }
  });

  // Get user's orders
  fastify.get('/api/orders', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = (request as any).user.id;

    try {
      const orders = await prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send({ orders });
    } catch (error: any) {
      console.error('Fetch orders error:', error);
      return reply.code(500).send({ error: 'Failed to fetch orders' });
    }
  });

  // Get specific order details
  fastify.get('/api/orders/:id', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as any;

    try {
      const order = await prisma.order.findFirst({
        where: {
          id,
          userId // Ensure user can only see their own orders
        }
      });

      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      return reply.send({ order });
    } catch (error: any) {
      console.error('Fetch order error:', error);
      return reply.code(500).send({ error: 'Failed to fetch order' });
    }
  });
}
