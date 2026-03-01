import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { adminGuard } from '../../supabaseauth';
import { validateData } from '../../utils/validation';

const reprintStatuses = [
  'REQUESTED',
  'APPROVED',
  'IN_QUEUE',
  'PRINTING',
  'DONE',
  'REJECTED',
  'CANCELLED',
] as const;

type ReprintStatus = (typeof reprintStatuses)[number];

/** Valid forward transitions for the reprint lifecycle */
const ALLOWED_TRANSITIONS: Record<ReprintStatus, ReprintStatus[]> = {
  REQUESTED:  ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED:   ['IN_QUEUE', 'CANCELLED'],
  IN_QUEUE:   ['PRINTING', 'CANCELLED'],
  PRINTING:   ['DONE', 'CANCELLED'],
  DONE:       [],
  REJECTED:   [],
  CANCELLED:  [],
};

const listQuerySchema = z.object({
  status:  z.enum(reprintStatuses).optional(),
  orderId: z.string().uuid().optional(),
  page:    z.coerce.number().int().positive().default(1),
  limit:   z.coerce.number().int().positive().max(100).default(20),
});

const createBodySchema = z.object({
  orderId: z.string().uuid('Invalid orderId'),
  reason:  z.string().min(1).max(2000),
  notes:   z.string().max(2000).optional(),
});

const updateStatusBodySchema = z.object({
  status: z.enum(reprintStatuses),
  notes:  z.string().max(2000).optional(),
});

const reprintIdParamSchema = z.object({
  id: z.string().uuid('Invalid reprint request id'),
});

export async function adminReprintRoutes(app: FastifyInstance) {
  // ── GET /admin/reprints ────────────────────────────────────────────────────
  app.get('/admin/reprints', { preHandler: [adminGuard] }, async (request, reply) => {
    const validation = validateData(listQuerySchema, request.query, reply);
    if (!validation.success) return;

    const { status, orderId, page, limit } = validation.data;
    const skip = (page - 1) * limit;

    const where = {
      ...(status ? { status } : {}),
      ...(orderId ? { orderId } : {}),
    };

    try {
      const [reprints, total] = await Promise.all([
        prisma.reprintRequest.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            order: {
              select: {
                id: true,
                status: true,
                productionStatus: true,
                createdAt: true,
              },
            },
          },
        }),
        prisma.reprintRequest.count({ where }),
      ]);

      return reply.send({
        reprints,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      logger.error({ error: err }, '[Reprints] Failed to list reprint requests');
      return reply.status(500).send({ error: 'Failed to list reprint requests' });
    }
  });

  // ── POST /admin/reprints ───────────────────────────────────────────────────
  app.post('/admin/reprints', { preHandler: [adminGuard] }, async (request, reply) => {
    const validation = validateData(createBodySchema, request.body, reply);
    if (!validation.success) return;

    const { orderId, reason, notes } = validation.data;
    const adminUserId = (request as any).user?.sub ?? 'admin';

    try {
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
      if (!order) return reply.status(404).send({ error: 'Order not found' });

      const reprint = await prisma.reprintRequest.create({
        data: {
          orderId,
          reason,
          notes: notes ?? null,
          requestedBy: adminUserId,
          status: 'REQUESTED',
        },
      });

      logger.info({ reprintId: reprint.id, orderId, adminUserId }, '[Reprints] Reprint request created');
      return reply.status(201).send({ reprint });
    } catch (err) {
      logger.error({ error: err, orderId }, '[Reprints] Failed to create reprint request');
      return reply.status(500).send({ error: 'Failed to create reprint request' });
    }
  });

  // ── PUT /admin/reprints/:id/status ─────────────────────────────────────────
  app.put('/admin/reprints/:id/status', { preHandler: [adminGuard] }, async (request, reply) => {
    const paramValidation = validateData(reprintIdParamSchema, request.params, reply);
    if (!paramValidation.success) return;

    const bodyValidation = validateData(updateStatusBodySchema, request.body, reply);
    if (!bodyValidation.success) return;

    const { id } = paramValidation.data;
    const { status: nextStatus, notes } = bodyValidation.data;
    const adminUserId = (request as any).user?.sub ?? 'admin';

    try {
      const reprint = await prisma.reprintRequest.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!reprint) return reply.status(404).send({ error: 'Reprint request not found' });

      const currentStatus = reprint.status as ReprintStatus;
      const allowed = ALLOWED_TRANSITIONS[currentStatus];

      if (!allowed.includes(nextStatus as ReprintStatus)) {
        return reply.status(400).send({
          error: 'Invalid reprint status transition',
          from: currentStatus,
          to: nextStatus,
          allowed,
        });
      }

      const updateData: Record<string, unknown> = {
        status: nextStatus,
        ...(notes ? { notes } : {}),
      };

      // Record who approved
      if (nextStatus === 'APPROVED') {
        updateData.approvedBy = adminUserId;
      }

      const updated = await prisma.reprintRequest.update({
        where: { id },
        data: updateData,
      });

      logger.info({ reprintId: id, from: currentStatus, to: nextStatus, adminUserId }, '[Reprints] Status updated');
      return reply.send({ reprint: updated });
    } catch (err) {
      logger.error({ error: err, id }, '[Reprints] Failed to update reprint status');
      return reply.status(500).send({ error: 'Failed to update reprint status' });
    }
  });
}
