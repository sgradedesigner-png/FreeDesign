import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { emailService } from '../../services/email.service';
import { adminGuard } from '../../supabaseauth';
import { validateData } from '../../utils/validation';
import { buildOrderPrintPack } from '../../services/printpack.service';
import {
  getAllowedProductionTransitions,
  getDefaultStatusCounts,
  isTransitionAllowed,
  deriveOrderStatusForProductionStatus,
  productionStatuses,
  type ProductionStatus,
} from '../../services/production.service';

const productionStatusQuerySchema = z.object({
  productionStatus: z.enum(productionStatuses).optional(),
  isCustomOrder: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

const updateProductionStatusBodySchema = z.object({
  status: z.enum(productionStatuses),
  notes: z.string().max(1000).optional(),
});

const batchUpdateProductionStatusBodySchema = z.object({
  orderIds: z.array(z.string().uuid('Invalid order id')).min(1).max(100),
  status: z.enum(productionStatuses),
  notes: z.string().max(1000).optional(),
});

const batchPrintPackBodySchema = z.object({
  orderIds: z.array(z.string().uuid('Invalid order id')).min(1).max(100),
});

const orderIdParamSchema = z.object({
  id: z.string().uuid('Invalid order id'),
});

type BatchStatusResult = {
  orderId: string;
  result: 'UPDATED' | 'UNCHANGED' | 'FAILED';
  fromStatus?: ProductionStatus;
  toStatus?: ProductionStatus;
  error?: string;
  allowedTransitions?: ProductionStatus[];
};

function queueProductionStatusUpdateEmail(params: {
  orderId: string;
  userId: string;
  fromStatus: ProductionStatus;
  toStatus: ProductionStatus;
  notes: string | null;
}) {
  setImmediate(async () => {
    const { orderId, userId, fromStatus, toStatus, notes } = params;

    try {
      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!profile?.email) {
        return;
      }

      const result = await emailService.sendProductionStatusUpdate(profile.email, {
        orderId,
        fromStatus,
        toStatus,
        notes,
      });

      if (!result.success) {
        logger.warn(
          { orderId, toStatus, error: result.error },
          'Failed to send production status email'
        );
      }
    } catch (emailError) {
      logger.error(
        { error: emailError, orderId, toStatus },
        'Unexpected error while sending production status email'
      );
    }
  });
}

export default async function adminProductionRoutes(app: FastifyInstance) {
  app.get('/admin/production/orders', {
    preHandler: [adminGuard],
  }, async (request, reply) => {
    const validation = validateData(productionStatusQuerySchema, request.query, reply);
    if (!validation.success) return;

    const { productionStatus, isCustomOrder, page, limit } = validation.data;
    const skip = (page - 1) * limit;

    const where = {
      ...(productionStatus ? { productionStatus } : {}),
      ...(isCustomOrder !== undefined ? { isCustomOrder } : {}),
    };

    try {
      const [orders, total, grouped] = await Promise.all([
        prisma.order.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            customizations: {
              include: {
                printArea: true,
                printSizeTier: true,
                asset: true,
              },
            },
          },
        }),
        prisma.order.count({ where }),
        prisma.order.groupBy({
          by: ['productionStatus'],
          _count: { id: true },
        }),
      ]);

      const statusCounts = getDefaultStatusCounts();
      for (const item of grouped) {
        statusCounts[item.productionStatus] = item._count.id;
      }

      return reply.send({
        orders,
        statusCounts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch production orders');
      return reply.code(500).send({ error: 'Failed to fetch production orders' });
    }
  });

  app.post('/admin/production/orders/batch-status', {
    preHandler: [adminGuard],
  }, async (request, reply) => {
    const bodyValidation = validateData(batchUpdateProductionStatusBodySchema, request.body, reply);
    if (!bodyValidation.success) return;

    const { orderIds, status, notes } = bodyValidation.data;
    const changedBy = (request as any).user?.sub || 'admin';
    const uniqueOrderIds = [...new Set(orderIds)];

    try {
      const orders = await prisma.order.findMany({
        where: { id: { in: uniqueOrderIds } },
        select: {
          id: true,
          userId: true,
          status: true,
          paymentStatus: true,
          productionStatus: true,
        },
      });

      const ordersById = new Map(orders.map((order) => [order.id, order]));
      const results: BatchStatusResult[] = [];

      for (const orderId of uniqueOrderIds) {
        const currentOrder = ordersById.get(orderId);

        if (!currentOrder) {
          results.push({
            orderId,
            result: 'FAILED',
            toStatus: status,
            error: 'Order not found',
          });
          continue;
        }

        const fromStatus = currentOrder.productionStatus;

        if (
          currentOrder.paymentStatus !== 'PAID' &&
          status !== 'NEW'
        ) {
          results.push({
            orderId,
            result: 'FAILED',
            fromStatus,
            toStatus: status,
            error: 'Only paid orders can progress beyond NEW production status',
          });
          continue;
        }

        if (!isTransitionAllowed(fromStatus, status)) {
          results.push({
            orderId,
            result: 'FAILED',
            fromStatus,
            toStatus: status,
            allowedTransitions: getAllowedProductionTransitions(fromStatus),
            error: 'Invalid production status transition',
          });
          continue;
        }

        if (fromStatus === status) {
          results.push({
            orderId,
            result: 'UNCHANGED',
            fromStatus,
            toStatus: status,
          });
          continue;
        }

        const nextOrderStatus = deriveOrderStatusForProductionStatus(status);

        try {
          await prisma.$transaction(async (tx) => {
            await tx.order.update({
              where: { id: orderId },
              data: {
                productionStatus: status,
                ...(nextOrderStatus ? { status: nextOrderStatus } : {}),
              },
            });

            await tx.productionStatusEvent.create({
              data: {
                orderId,
                fromStatus,
                toStatus: status,
                changedBy,
                notes: notes ?? null,
              },
            });
          });

          results.push({
            orderId,
            result: 'UPDATED',
            fromStatus,
            toStatus: status,
          });

          queueProductionStatusUpdateEmail({
            orderId,
            userId: currentOrder.userId,
            fromStatus,
            toStatus: status,
            notes: notes ?? null,
          });
        } catch (orderError) {
          logger.error({ error: orderError, orderId, status }, 'Failed to update order in batch');
          results.push({
            orderId,
            result: 'FAILED',
            fromStatus,
            toStatus: status,
            error: 'Failed to update production status',
          });
        }
      }

      const summary = {
        requested: orderIds.length,
        unique: uniqueOrderIds.length,
        processed: results.length,
        updated: results.filter((item) => item.result === 'UPDATED').length,
        unchanged: results.filter((item) => item.result === 'UNCHANGED').length,
        failed: results.filter((item) => item.result === 'FAILED').length,
      };

      return reply.send({
        summary,
        results,
      });
    } catch (error) {
      logger.error({ error, status }, 'Failed to process batch production status update');
      return reply.code(500).send({ error: 'Failed to process batch production status update' });
    }
  });

  app.post('/admin/production/orders/batch-print-pack', {
    preHandler: [adminGuard],
  }, async (request, reply) => {
    const bodyValidation = validateData(batchPrintPackBodySchema, request.body, reply);
    if (!bodyValidation.success) return;

    const { orderIds } = bodyValidation.data;
    const uniqueOrderIds = [...new Set(orderIds)];

    try {
      const result = await Promise.all(uniqueOrderIds.map(async (orderId) => {
        try {
          const payload = await buildOrderPrintPack(orderId);
          return { orderId, payload, error: null as string | null };
        } catch (error: any) {
          const message = typeof error?.message === 'string'
            ? error.message
            : 'Failed to generate print pack';
          return { orderId, payload: null, error: message };
        }
      }));

      const packs = result
        .filter((item): item is { orderId: string; payload: Awaited<ReturnType<typeof buildOrderPrintPack>>; error: null } => Boolean(item.payload))
        .map((item) => item.payload);

      const failures = result
        .filter((item) => !item.payload)
        .map((item) => ({
          orderId: item.orderId,
          error: item.error || 'Failed to generate print pack',
        }));

      return reply.send({
        generatedAt: new Date().toISOString(),
        summary: {
          requested: orderIds.length,
          unique: uniqueOrderIds.length,
          success: packs.length,
          failed: failures.length,
        },
        packs,
        failures,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to generate batch print packs');
      return reply.code(500).send({ error: 'Failed to generate batch print packs' });
    }
  });

  app.put('/admin/orders/:id/production-status', {
    preHandler: [adminGuard],
  }, async (request, reply) => {
    const paramValidation = validateData(orderIdParamSchema, request.params, reply);
    if (!paramValidation.success) return;

    const bodyValidation = validateData(updateProductionStatusBodySchema, request.body, reply);
    if (!bodyValidation.success) return;

    const { id } = paramValidation.data;
    const { status, notes } = bodyValidation.data;
    const changedBy = (request as any).user?.sub || 'admin';

    try {
      const currentOrder = await prisma.order.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          status: true,
          paymentStatus: true,
          productionStatus: true,
        },
      });

      if (!currentOrder) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      if (
        currentOrder.paymentStatus !== 'PAID' &&
        status !== 'NEW'
      ) {
        return reply.code(400).send({
          error: 'Only paid orders can progress beyond NEW production status',
        });
      }

      const fromStatus = currentOrder.productionStatus;
      if (!isTransitionAllowed(fromStatus, status)) {
        return reply.code(400).send({
          error: 'Invalid production status transition',
          fromStatus,
          toStatus: status,
          allowedTransitions: getAllowedProductionTransitions(fromStatus),
        });
      }

      if (fromStatus === status) {
        return reply.send({
          order: currentOrder,
          unchanged: true,
        });
      }

      const nextOrderStatus = deriveOrderStatusForProductionStatus(status);

      const updatedOrder = await prisma.$transaction(async (tx) => {
        const order = await tx.order.update({
          where: { id },
          data: {
            productionStatus: status,
            ...(nextOrderStatus ? { status: nextOrderStatus } : {}),
          },
        });

        await tx.productionStatusEvent.create({
          data: {
            orderId: id,
            fromStatus,
            toStatus: status,
            changedBy,
            notes: notes ?? null,
          },
        });

        return order;
      });

      queueProductionStatusUpdateEmail({
        orderId: currentOrder.id,
        userId: currentOrder.userId,
        fromStatus,
        toStatus: status,
        notes: notes ?? null,
      });

      return reply.send({ order: updatedOrder });
    } catch (error) {
      logger.error({ error, id, status }, 'Failed to update production status');
      return reply.code(500).send({ error: 'Failed to update production status' });
    }
  });

  app.get('/admin/orders/:id/print-pack', {
    preHandler: [adminGuard],
  }, async (request, reply) => {
    const paramValidation = validateData(orderIdParamSchema, request.params, reply);
    if (!paramValidation.success) return;

    const { id } = paramValidation.data;

    try {
      const payload = await buildOrderPrintPack(id);
      return reply.send(payload);
    } catch (error: any) {
      if (error?.statusCode === 404) {
        return reply.code(404).send({ error: error.message });
      }

      logger.error({ error, id }, 'Failed to generate print pack');
      return reply.code(500).send({ error: 'Failed to generate print pack' });
    }
  });

  // ── P3-05: Hold / Release ──────────────────────────────────────────────────

  const holdBodySchema = z.object({
    reason: z.string().min(1).max(2000),
    notes:  z.string().max(2000).optional(),
  });

  app.post('/admin/orders/:id/hold', { preHandler: [adminGuard] }, async (request, reply) => {
    const paramValidation = validateData(orderIdParamSchema, request.params, reply);
    if (!paramValidation.success) return;
    const { id: orderId } = paramValidation.data;

    const bodyValidation = validateData(holdBodySchema, request.body, reply);
    if (!bodyValidation.success) return;
    const { reason, notes } = bodyValidation.data;
    const adminUserId = (request as any).user?.sub ?? 'admin';

    try {
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, isOnHold: true } });
      if (!order) return reply.status(404).send({ error: 'Order not found' });
      if (order.isOnHold) return reply.status(409).send({ error: 'Order is already on hold' });

      await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: orderId }, data: { isOnHold: true } });
        await tx.orderHold.create({ data: { orderId, reason, notes: notes ?? null, heldBy: adminUserId } });
      });

      logger.info({ orderId, adminUserId }, '[Production] Order put on hold');
      return reply.send({ message: 'Order placed on hold' });
    } catch (err) {
      logger.error({ error: err, orderId }, '[Production] Failed to hold order');
      return reply.status(500).send({ error: 'Failed to place order on hold' });
    }
  });

  app.delete('/admin/orders/:id/hold', { preHandler: [adminGuard] }, async (request, reply) => {
    const paramValidation = validateData(orderIdParamSchema, request.params, reply);
    if (!paramValidation.success) return;
    const { id: orderId } = paramValidation.data;
    const adminUserId = (request as any).user?.sub ?? 'admin';

    const releaseBodySchema = z.object({ notes: z.string().max(2000).optional() });
    const bodyValidation = validateData(releaseBodySchema, (request.body as object) ?? {}, reply);
    if (!bodyValidation.success) return;
    const { notes } = bodyValidation.data;

    try {
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, isOnHold: true } });
      if (!order) return reply.status(404).send({ error: 'Order not found' });
      if (!order.isOnHold) return reply.status(409).send({ error: 'Order is not on hold' });

      const now = new Date();
      const activeHold = await prisma.orderHold.findFirst({
        where: { orderId, releasedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: orderId }, data: { isOnHold: false } });
        if (activeHold) {
          await tx.orderHold.update({
            where: { id: activeHold.id },
            data: { releasedBy: adminUserId, releasedAt: now, ...(notes ? { notes } : {}) },
          });
        }
      });

      logger.info({ orderId, adminUserId }, '[Production] Order hold released');
      return reply.send({ message: 'Order hold released' });
    } catch (err) {
      logger.error({ error: err, orderId }, '[Production] Failed to release hold');
      return reply.status(500).send({ error: 'Failed to release order hold' });
    }
  });

  // ── P3-05: SLA assignment ──────────────────────────────────────────────────

  const slaBodySchema = z.object({
    slaDueAt: z.string().datetime({ offset: true }),
    slaTier:  z.enum(['STANDARD', 'RUSH', 'CRITICAL'] as const).default('STANDARD'),
    notes:    z.string().max(2000).optional(),
  });

  app.put('/admin/orders/:id/sla', { preHandler: [adminGuard] }, async (request, reply) => {
    const paramValidation = validateData(orderIdParamSchema, request.params, reply);
    if (!paramValidation.success) return;
    const { id: orderId } = paramValidation.data;

    const bodyValidation = validateData(slaBodySchema, request.body, reply);
    if (!bodyValidation.success) return;
    const { slaDueAt, slaTier, notes } = bodyValidation.data;
    const adminUserId = (request as any).user?.sub ?? 'admin';

    try {
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
      if (!order) return reply.status(404).send({ error: 'Order not found' });

      const dueAt = new Date(slaDueAt);
      await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: orderId }, data: { slaDueAt: dueAt } });
        await tx.orderSlaEvent.create({
          data: { orderId, slaDueAt: dueAt, slaTier, notes: notes ?? null, setBy: adminUserId },
        });
      });

      logger.info({ orderId, slaDueAt, slaTier }, '[Production] SLA set');
      return reply.send({ message: 'SLA updated', slaDueAt: dueAt, slaTier });
    } catch (err) {
      logger.error({ error: err, orderId }, '[Production] Failed to set SLA');
      return reply.status(500).send({ error: 'Failed to set SLA' });
    }
  });
}
