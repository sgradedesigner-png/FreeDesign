import { logger } from '../lib/logger';
// backend/src/routes/admin/orders.ts
import { FastifyInstance } from 'fastify';
import { adminGuard } from '../../supabaseauth';
import { prisma } from '../../lib/prisma';

/**
 * Helper function to check and update expired orders
 * Checks if order's QPay invoice has expired and updates status to EXPIRED
 */
async function checkAndUpdateExpiredOrders(orders: any[]) {
  const now = new Date();
  const expiredOrderIds: string[] = [];

  // Find orders that are expired
  for (const order of orders) {
    if (
      order.qpayInvoiceExpiresAt &&
      order.status === 'PENDING' &&
      order.paymentStatus === 'UNPAID' &&
      new Date(order.qpayInvoiceExpiresAt) < now
    ) {
      expiredOrderIds.push(order.id);
    }
  }

  // Update expired orders in bulk
  if (expiredOrderIds.length > 0) {
    await prisma.order.updateMany({
      where: {
        id: { in: expiredOrderIds }
      },
      data: {
        status: 'EXPIRED',
        expiredAt: now,
        updatedAt: now
      }
    });

    logger.info(`[Admin Order Expiration] Updated ${expiredOrderIds.length} expired orders: ${expiredOrderIds.join(', ')}`);

    // Update the orders in the array to reflect new status
    for (const order of orders) {
      if (expiredOrderIds.includes(order.id)) {
        order.status = 'EXPIRED';
        order.expiredAt = now;
        order.updatedAt = now;
      }
    }
  }

  return orders;
}

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
      const [fetchedOrders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.order.count({ where })
      ]);

      // Check and update expired orders automatically
      const orders = await checkAndUpdateExpiredOrders(fetchedOrders);

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
      logger.error('Admin fetch orders error:', error);
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
      let order = await prisma.order.findUnique({
        where: { id }
      });

      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      // Check and update if expired
      const updatedOrders = await checkAndUpdateExpiredOrders([order]);
      order = updatedOrders[0];

      return reply.send({ order });
    } catch (error: any) {
      logger.error('Admin fetch order error:', error);
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
    const validStatuses = ['PENDING', 'PAID', 'EXPIRED', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return reply.code(400).send({ error: 'Invalid status' });
    }

    try {
      const order = await prisma.order.update({
        where: { id },
        data: { status }
      });

      logger.info(`✅ Order ${id} status updated to ${status}`);

      return reply.send({ order });
    } catch (error: any) {
      logger.error('Update order error:', error);
      return reply.code(500).send({ error: 'Failed to update order' });
    }
  });
}
