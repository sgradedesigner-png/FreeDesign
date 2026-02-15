import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { adminGuard } from '../../supabaseauth';
import { NotFoundError, ValidationError } from '../../utils/errors';

/**
 * P2-07: Admin Upload Moderation Queue
 * Endpoints for reviewing and moderating uploaded files
 */

const queueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'FLAGGED']).optional(),
  uploadFamily: z.string().optional(),
  validationStatus: z.enum(['PENDING', 'PROCESSING', 'PASSED', 'FAILED', 'DEAD_LETTER']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

const moderationActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'flag']),
  reason: z.string().min(3).max(500).optional(),
});

export const adminUploadsRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply admin guard to all routes
  fastify.addHook('onRequest', adminGuard);

  /**
   * GET /api/admin/uploads/queue
   * List uploads for moderation with filters
   */
  fastify.get('/queue', async (request, reply) => {
    const query = queueQuerySchema.parse(request.query);

    const where: any = {};

    if (query.status) {
      where.moderationStatus = query.status;
    }

    if (query.validationStatus) {
      where.validationStatus = query.validationStatus;
    }

    if (query.uploadFamily) {
      where.uploadFamily = query.uploadFamily;
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.createdAt.lte = new Date(query.dateTo);
      }
    }

    const skip = (query.page - 1) * query.limit;

    const [uploads, total] = await Promise.all([
      prisma.uploadAsset.findMany({
        where,
        include: {
          moderationActions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          validationJobs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              events: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
          orderItemUploads: {
            include: {
              orderItem: {
                select: {
                  orderId: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.uploadAsset.count({ where }),
    ]);

    // Get status counts for filters
    const statusCounts = await prisma.uploadAsset.groupBy({
      by: ['moderationStatus'],
      _count: { id: true },
    });

    const statusCountMap = statusCounts.reduce(
      (acc, item) => {
        acc[item.moderationStatus] = item._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    return reply.send({
      uploads,
      statusCounts: statusCountMap,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  });

  /**
   * GET /api/admin/uploads/:id
   * Get detailed upload info with full moderation history
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const upload = await prisma.uploadAsset.findUnique({
      where: { id },
      include: {
        moderationActions: {
          orderBy: { createdAt: 'desc' },
        },
        validationJobs: {
          orderBy: { createdAt: 'desc' },
          include: {
            events: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        orderItemUploads: {
          include: {
            orderItem: {
              select: {
                id: true,
                orderId: true,
                productId: true,
                productName: true,
                variantName: true,
              },
            },
          },
        },
      },
    });

    if (!upload) {
      throw new NotFoundError('Upload not found');
    }

    return reply.send({ upload });
  });

  /**
   * POST /api/admin/uploads/:id/moderate
   * Apply moderation action to upload
   */
  fastify.post('/:id/moderate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = moderationActionSchema.parse(request.body);
    const actorId = (request as any).user?.id;

    if (!actorId) {
      throw new ValidationError('Actor ID required');
    }

    const upload = await prisma.uploadAsset.findUnique({
      where: { id },
      select: {
        id: true,
        moderationStatus: true,
        validationStatus: true,
      },
    });

    if (!upload) {
      throw new NotFoundError('Upload not found');
    }

    // Determine new status based on action
    let newStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'FLAGGED';

    switch (body.action) {
      case 'approve':
        newStatus = 'APPROVED';
        break;
      case 'reject':
        newStatus = 'REJECTED';
        break;
      case 'flag':
        newStatus = 'FLAGGED';
        break;
      default:
        throw new ValidationError('Invalid action');
    }

    // Validate state transition
    if (upload.moderationStatus === newStatus) {
      throw new ValidationError(`Upload already ${newStatus.toLowerCase()}`);
    }

    // Atomic update with audit trail
    const [updatedUpload, moderationAction] = await prisma.$transaction([
      prisma.uploadAsset.update({
        where: { id },
        data: {
          moderationStatus: newStatus,
        },
      }),
      prisma.uploadModerationAction.create({
        data: {
          uploadAssetId: id,
          actorId,
          action: body.action,
          reason: body.reason || null,
          previousStatus: upload.moderationStatus,
          newStatus,
          metadata: {
            validationStatus: upload.validationStatus,
            timestamp: new Date().toISOString(),
          },
        },
      }),
    ]);

    return reply.send({
      upload: updatedUpload,
      action: moderationAction,
    });
  });

  /**
   * GET /api/admin/uploads/:id/audit
   * Get full moderation audit trail for upload
   */
  fastify.get('/:id/audit', async (request, reply) => {
    const { id } = request.params as { id: string };

    const actions = await prisma.uploadModerationAction.findMany({
      where: { uploadAssetId: id },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ actions });
  });

  /**
   * GET /api/admin/uploads/stats/overview
   * Get moderation queue statistics
   */
  fastify.get('/stats/overview', async (request, reply) => {
    const [
      totalPending,
      totalApproved,
      totalRejected,
      totalFlagged,
      validationFailed,
      recentActions,
    ] = await Promise.all([
      prisma.uploadAsset.count({ where: { moderationStatus: 'PENDING_REVIEW' } }),
      prisma.uploadAsset.count({ where: { moderationStatus: 'APPROVED' } }),
      prisma.uploadAsset.count({ where: { moderationStatus: 'REJECTED' } }),
      prisma.uploadAsset.count({ where: { moderationStatus: 'FLAGGED' } }),
      prisma.uploadAsset.count({
        where: {
          validationStatus: 'FAILED',
          moderationStatus: 'PENDING_REVIEW',
        },
      }),
      prisma.uploadModerationAction.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }),
    ]);

    return reply.send({
      statusCounts: {
        pending: totalPending,
        approved: totalApproved,
        rejected: totalRejected,
        flagged: totalFlagged,
      },
      validationFailed,
      recentActions24h: recentActions,
    });
  });
};
