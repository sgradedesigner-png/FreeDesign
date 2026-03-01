import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { adminGuard } from '../../supabaseauth';
import { validateData } from '../../utils/validation';

const ruleTypes = ['PRINT_FEE', 'EXTRA_SIDE', 'QUANTITY_DISCOUNT', 'RUSH_FEE', 'ADD_ON'] as const;

const pricingRuleBodySchema = z.object({
  name: z.string().min(2).max(200),
  ruleType: z.enum(ruleTypes),
  printSizeTierId: z.string().uuid().optional().nullable(),
  printAreaId: z.string().uuid().optional().nullable(),
  minQuantity: z.number().int().positive().optional().nullable(),
  maxQuantity: z.number().int().positive().optional().nullable(),
  price: z.number().finite(),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const pricingRuleUpdateSchema = pricingRuleBodySchema.partial();

const pricingRuleIdParamSchema = z.object({
  id: z.string().uuid('Invalid pricing rule id'),
});

const pricingRuleQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional().default(true),
});

type PricingRulePayload = z.infer<typeof pricingRuleBodySchema>;
type PricingRuleUpdatePayload = z.infer<typeof pricingRuleUpdateSchema>;

function normalizeNullableFields<T extends {
  printSizeTierId?: string | null;
  printAreaId?: string | null;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  discountPercent?: number | null;
}>(payload: T): T {
  return {
    ...payload,
    printSizeTierId: payload.printSizeTierId ?? null,
    printAreaId: payload.printAreaId ?? null,
    minQuantity: payload.minQuantity ?? null,
    maxQuantity: payload.maxQuantity ?? null,
    discountPercent: payload.discountPercent ?? null,
  };
}

function validateRuleBusinessConstraints(payload: {
  ruleType?: typeof ruleTypes[number];
  printSizeTierId?: string | null;
  printAreaId?: string | null;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  price?: number;
  discountPercent?: number | null;
}) {
  if (
    payload.minQuantity != null &&
    payload.maxQuantity != null &&
    payload.minQuantity > payload.maxQuantity
  ) {
    return 'minQuantity cannot be greater than maxQuantity';
  }

  if (!payload.ruleType) return null;

  if (payload.price != null && payload.price < 0) {
    return 'price must be non-negative';
  }

  if (payload.ruleType === 'PRINT_FEE') {
    if (!payload.printSizeTierId) {
      return 'PRINT_FEE requires printSizeTierId';
    }
    if (payload.discountPercent != null) {
      return 'PRINT_FEE does not use discountPercent';
    }
    return null;
  }

  if (payload.ruleType === 'EXTRA_SIDE') {
    if (payload.discountPercent != null) {
      return 'EXTRA_SIDE does not use discountPercent';
    }
    return null;
  }

  if (payload.ruleType === 'QUANTITY_DISCOUNT') {
    if (!payload.minQuantity) {
      return 'QUANTITY_DISCOUNT requires minQuantity';
    }
    if (payload.discountPercent == null) {
      return 'QUANTITY_DISCOUNT requires discountPercent';
    }
    return null;
  }

  if (payload.ruleType === 'RUSH_FEE') {
    if (payload.discountPercent != null) {
      return 'RUSH_FEE does not use discountPercent';
    }
    return null;
  }

  if (payload.ruleType === 'ADD_ON') {
    if (payload.discountPercent != null) {
      return 'ADD_ON does not use discountPercent';
    }
  }

  return null;
}

async function validateReferences(payload: {
  printSizeTierId?: string | null;
  printAreaId?: string | null;
}) {
  const checks: Promise<unknown>[] = [];

  if (payload.printSizeTierId) {
    checks.push(
      prisma.printSizeTier.findUnique({
        where: { id: payload.printSizeTierId },
        select: { id: true },
      }).then((record) => {
        if (!record) throw new Error('Invalid printSizeTierId');
      })
    );
  }

  if (payload.printAreaId) {
    checks.push(
      prisma.printArea.findUnique({
        where: { id: payload.printAreaId },
        select: { id: true },
      }).then((record) => {
        if (!record) throw new Error('Invalid printAreaId');
      })
    );
  }

  await Promise.all(checks);
}

export default async function adminPricingRoutes(app: FastifyInstance) {
  app.get('/admin/pricing/rules', {
    preHandler: [adminGuard],
  }, async (request, reply) => {
    const validation = validateData(pricingRuleQuerySchema, request.query, reply);
    if (!validation.success) return;

    try {
      const { includeInactive } = validation.data;

      const [rules, printAreas, printSizeTiers] = await Promise.all([
        prisma.pricingRule.findMany({
          where: includeInactive ? {} : { isActive: true },
          include: {
            printArea: true,
            printSizeTier: true,
          },
          orderBy: [
            { ruleType: 'asc' },
            { createdAt: 'desc' },
          ],
        }),
        prisma.printArea.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        }),
        prisma.printSizeTier.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        }),
      ]);

      return reply.send({ rules, printAreas, printSizeTiers });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch pricing rules');
      return reply.code(500).send({ error: 'Failed to fetch pricing rules' });
    }
  });

  app.post('/admin/pricing/rules', {
    preHandler: [adminGuard],
  }, async (request, reply) => {
    const validation = validateData(pricingRuleBodySchema, request.body, reply);
    if (!validation.success) return;

    try {
      const normalized = normalizeNullableFields<PricingRulePayload>(validation.data);
      const constraintError = validateRuleBusinessConstraints(normalized);
      if (constraintError) {
        return reply.code(400).send({ error: constraintError });
      }

      await validateReferences(normalized);

      const rule = await prisma.pricingRule.create({
        data: {
          ...normalized,
          price: normalized.price.toString(),
        },
      });

      return reply.code(201).send({ rule });
    } catch (error: any) {
      logger.error({ error }, 'Failed to create pricing rule');
      return reply.code(500).send({ error: error?.message || 'Failed to create pricing rule' });
    }
  });

  app.put('/admin/pricing/rules/:id', {
    preHandler: [adminGuard],
  }, async (request, reply) => {
    const paramValidation = validateData(pricingRuleIdParamSchema, request.params, reply);
    if (!paramValidation.success) return;

    const bodyValidation = validateData(pricingRuleUpdateSchema, request.body, reply);
    if (!bodyValidation.success) return;

    const { id } = paramValidation.data;
    const payload = bodyValidation.data;

    try {
      const existing = await prisma.pricingRule.findUnique({
        where: { id },
      });

      if (!existing) {
        return reply.code(404).send({ error: 'Pricing rule not found' });
      }

      const merged = normalizeNullableFields<PricingRuleUpdatePayload>({
        ruleType: existing.ruleType as typeof ruleTypes[number],
        name: existing.name,
        printSizeTierId: existing.printSizeTierId,
        printAreaId: existing.printAreaId,
        minQuantity: existing.minQuantity,
        maxQuantity: existing.maxQuantity,
        price: Number(existing.price),
        discountPercent: existing.discountPercent,
        isActive: existing.isActive,
        ...payload,
      });

      const constraintError = validateRuleBusinessConstraints(merged);
      if (constraintError) {
        return reply.code(400).send({ error: constraintError });
      }

      await validateReferences(merged);

      const updateData: Record<string, unknown> = {};

      if ('name' in payload) updateData.name = payload.name;
      if ('ruleType' in payload) updateData.ruleType = payload.ruleType;
      if ('printSizeTierId' in payload) updateData.printSizeTierId = payload.printSizeTierId ?? null;
      if ('printAreaId' in payload) updateData.printAreaId = payload.printAreaId ?? null;
      if ('minQuantity' in payload) updateData.minQuantity = payload.minQuantity ?? null;
      if ('maxQuantity' in payload) updateData.maxQuantity = payload.maxQuantity ?? null;
      if ('discountPercent' in payload) updateData.discountPercent = payload.discountPercent ?? null;
      if ('isActive' in payload) updateData.isActive = payload.isActive;
      if ('price' in payload && payload.price !== undefined) {
        updateData.price = payload.price.toString();
      }

      const rule = await prisma.pricingRule.update({
        where: { id },
        data: updateData,
      });

      return reply.send({ rule });
    } catch (error: any) {
      logger.error({ error, id }, 'Failed to update pricing rule');
      return reply.code(500).send({ error: error?.message || 'Failed to update pricing rule' });
    }
  });

  app.delete('/admin/pricing/rules/:id', {
    preHandler: [adminGuard],
  }, async (request, reply) => {
    const paramValidation = validateData(pricingRuleIdParamSchema, request.params, reply);
    if (!paramValidation.success) return;

    const { id } = paramValidation.data;

    try {
      const rule = await prisma.pricingRule.update({
        where: { id },
        data: {
          isActive: false,
        },
      });

      return reply.send({ rule });
    } catch (error) {
      logger.error({ error, id }, 'Failed to deactivate pricing rule');
      return reply.code(500).send({ error: 'Failed to deactivate pricing rule' });
    }
  });

  // POST /admin/pricing/preview - Calculate pricing preview for product wizard
  app.post('/admin/pricing/preview', {
    preHandler: [adminGuard],
  }, async (request, reply) => {
    const schema = z.object({
      sizeTierId: z.string().uuid(),
      printAreaIds: z.array(z.string().uuid()),
      quantity: z.number().int().min(1),
      rushOrder: z.boolean(),
    });

    const validation = validateData(schema, request.body, reply);
    if (!validation.success) return;

    try {
      const { sizeTierId, printAreaIds, quantity, rushOrder } = validation.data;

      // Fetch print fee for the size tier
      const printFee = await prisma.pricingRule.findFirst({
        where: {
          ruleType: 'PRINT_FEE',
          printSizeTierId: sizeTierId,
          isActive: true,
        },
        include: {
          printSizeTier: true,
        },
      });

      if (!printFee) {
        return reply.code(404).send({ error: 'Print fee not found for this size tier' });
      }

      // Fetch extra side fee
      const extraSideFee = await prisma.pricingRule.findFirst({
        where: {
          ruleType: 'EXTRA_SIDE',
          isActive: true,
        },
      });

      // Fetch rush fee
      const rushFeeRule = await prisma.pricingRule.findFirst({
        where: {
          ruleType: 'RUSH_FEE',
          isActive: true,
        },
      });

      // Fetch quantity discount
      const quantityDiscount = await prisma.pricingRule.findFirst({
        where: {
          ruleType: 'QUANTITY_DISCOUNT',
          minQuantity: { lte: quantity },
          OR: [
            { maxQuantity: { gte: quantity } },
            { maxQuantity: null },
          ],
          isActive: true,
        },
        orderBy: {
          minQuantity: 'desc',
        },
      });

      // Calculate totals
      const baseFee = Number(printFee.price);
      const extraSides = Math.max(0, printAreaIds.length - 1);
      const extraSideFeeTotal = extraSides * Number(extraSideFee?.price || 0);
      const rushFeeTotal = rushOrder ? Number(rushFeeRule?.price || 0) : 0;

      const subtotal = (baseFee + extraSideFeeTotal) * quantity;
      const discountPercent = quantityDiscount?.discountPercent || 0;
      const discountAmount = (subtotal * discountPercent) / 100;
      const total = subtotal - discountAmount + rushFeeTotal;

      return reply.send({
        sizeTierName: printFee.printSizeTier?.label || printFee.printSizeTier?.name || 'Unknown',
        baseFee,
        extraSideFee: Number(extraSideFee?.price || 0),
        extraSides,
        extraSideFeeTotal,
        rushFee: Number(rushFeeRule?.price || 0),
        rushFeeTotal,
        quantity,
        subtotal,
        discountPercent,
        discountAmount,
        total,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to calculate pricing preview');
      return reply.code(500).send({ error: 'Failed to calculate pricing preview' });
    }
  });
}
