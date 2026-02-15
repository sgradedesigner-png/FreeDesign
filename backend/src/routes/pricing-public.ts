import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Public Pricing Endpoints
 * Provides tier pricing and finishing options for by-size products
 */
export default async function pricingPublicRoutes(app: FastifyInstance) {
  /**
   * GET /api/pricing/tiers/:variantId
   * Get quantity-based pricing tiers for a variant
   *
   * Response example:
   * {
   *   "variantId": "abc123",
   *   "tiers": [
   *     { "minQuantity": 1, "maxQuantity": 10, "unitPrice": "5.00" },
   *     { "minQuantity": 11, "maxQuantity": 50, "unitPrice": "4.50" },
   *     { "minQuantity": 51, "maxQuantity": 100, "unitPrice": "4.00" },
   *     { "minQuantity": 101, "maxQuantity": null, "unitPrice": "3.50" }
   *   ]
   * }
   */
  app.get(
    '/api/pricing/tiers/:variantId',
    {
      schema: {
        description: 'Get pricing tiers for a variant',
        tags: ['Pricing'],
        params: {
          type: 'object',
          required: ['variantId'],
          properties: {
            variantId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { variantId } = request.params as { variantId: string };

      try {
        // Get variant with price tiers
        const variant = await prisma.productVariant.findUnique({
          where: { id: variantId },
          include: {
            priceTiers: {
              orderBy: {
                minQuantity: 'asc',
              },
            },
          },
        });

        if (!variant) {
          return reply.code(404).send({ error: 'Variant not found' });
        }

        // If no tiers defined, return base price as single tier
        if (!variant.priceTiers || variant.priceTiers.length === 0) {
          return reply.send({
            variantId: variant.id,
            tiers: [
              {
                minQuantity: 1,
                maxQuantity: null,
                unitPrice: variant.price.toString(),
              },
            ],
          });
        }

        // Return tiers
        return reply.send({
          variantId: variant.id,
          tiers: variant.priceTiers.map((tier) => ({
            minQuantity: tier.minQuantity,
            maxQuantity: tier.maxQuantity,
            unitPrice: tier.unitPrice.toString(),
          })),
        });
      } catch (error) {
        app.log.error(error);
        return reply.code(500).send({ error: 'Failed to load pricing tiers' });
      }
    }
  );

  /**
   * POST /api/pricing/calculate
   * Calculate total price for a by-size product with finishing options
   *
   * Request body:
   * {
   *   "variantId": "abc123",
   *   "quantity": 25,
   *   "finishing": "pre_cut" // or "roll"
   * }
   *
   * Response:
   * {
   *   "variantId": "abc123",
   *   "quantity": 25,
   *   "finishing": "pre_cut",
   *   "tierUnitPrice": "4.50",
   *   "finishingSurcharge": "0.90", // 20% of tier price
   *   "finalUnitPrice": "5.40",
   *   "subtotal": "135.00",
   *   "appliedTier": {
   *     "minQuantity": 11,
   *     "maxQuantity": 50,
   *     "unitPrice": "4.50"
   *   }
   * }
   */
  app.post(
    '/api/pricing/calculate',
    {
      schema: {
        description: 'Calculate price with finishing options',
        tags: ['Pricing'],
        body: {
          type: 'object',
          required: ['variantId', 'quantity'],
          properties: {
            variantId: { type: 'string' },
            quantity: { type: 'integer', minimum: 1 },
            finishing: { type: 'string', enum: ['roll', 'pre_cut'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { variantId, quantity, finishing = 'roll' } = request.body as {
        variantId: string;
        quantity: number;
        finishing?: 'roll' | 'pre_cut';
      };

      try {
        // Get variant with price tiers
        const variant = await prisma.productVariant.findUnique({
          where: { id: variantId },
          include: {
            priceTiers: {
              orderBy: {
                minQuantity: 'asc',
              },
            },
          },
        });

        if (!variant) {
          return reply.code(404).send({ error: 'Variant not found' });
        }

        // Find applicable tier
        let appliedTier = variant.priceTiers.find(
          (tier) =>
            quantity >= tier.minQuantity &&
            (tier.maxQuantity === null || quantity <= tier.maxQuantity)
        );

        // Fallback to base price if no tiers
        if (!appliedTier) {
          appliedTier = {
            id: 'base',
            variantId: variant.id,
            minQuantity: 1,
            maxQuantity: null,
            unitPrice: variant.price,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }

        const tierUnitPrice = Number(appliedTier.unitPrice);

        // Calculate finishing surcharge (20% for pre-cut)
        const FINISHING_SURCHARGE_PERCENTAGE = 0.2;
        const finishingSurcharge =
          finishing === 'pre_cut' ? tierUnitPrice * FINISHING_SURCHARGE_PERCENTAGE : 0;

        const finalUnitPrice = tierUnitPrice + finishingSurcharge;
        const subtotal = finalUnitPrice * quantity;

        return reply.send({
          variantId: variant.id,
          quantity,
          finishing,
          tierUnitPrice: tierUnitPrice.toFixed(2),
          finishingSurcharge: finishingSurcharge.toFixed(2),
          finalUnitPrice: finalUnitPrice.toFixed(2),
          subtotal: subtotal.toFixed(2),
          appliedTier: {
            minQuantity: appliedTier.minQuantity,
            maxQuantity: appliedTier.maxQuantity,
            unitPrice: appliedTier.unitPrice.toString(),
          },
        });
      } catch (error) {
        app.log.error(error);
        return reply.code(500).send({ error: 'Failed to calculate price' });
      }
    }
  );
}
