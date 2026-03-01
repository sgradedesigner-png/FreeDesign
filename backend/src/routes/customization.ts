import type { FastifyInstance } from 'fastify';
import { logger, hashIdentifier } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { userGuard } from '../middleware/userGuard';
import { mockupPreviewSchema, priceQuoteSchema } from '../schemas/customization.schema';
import { uploadCustomizationAsset } from '../services/asset.service';
import { buildCustomizationMockupPreviewUrl } from '../services/mockup.service';
import { calculatePriceQuote } from '../services/pricing.service';
import { settingsService } from '../services/settings.service';
import { AppError, BadRequestError } from '../utils/errors';
import { validateData } from '../utils/validation';
import { z } from 'zod';

const customizationOptionsQuerySchema = z.object({
  variantId: z.string().uuid('Invalid variantId'),
});

export default async function customizationRoutes(app: FastifyInstance) {
  app.get('/api/customization/ui-settings', async (_request, reply) => {
    try {
      const sizeFinderEnabled = await settingsService.getSizeFinderEnabled();
      return reply.send({ sizeFinderEnabled });
    } catch (error) {
      logger.error({ error }, 'Failed to load customization UI settings');
      return reply.code(500).send({ error: 'Failed to load customization UI settings' });
    }
  });

  app.get('/api/customization/options', async (request, reply) => {
    const validation = validateData(customizationOptionsQuerySchema, request.query, reply);
    if (!validation.success) {
      return;
    }

    const { variantId } = validation.data;

    try {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: {
          id: true,
          product: {
            select: {
              id: true,
              isCustomizable: true,
              productFamily: true,
              metadata: true,
              printAreas: {
                select: {
                  isDefault: true,
                  printArea: {
                    select: {
                      id: true,
                      name: true,
                      label: true,
                      labelEn: true,
                      maxWidthCm: true,
                      maxHeightCm: true,
                      sortOrder: true,
                    },
                  },
                },
                orderBy: {
                  printArea: {
                    sortOrder: 'asc',
                  },
                },
              },
            },
          },
        },
      });

      if (!variant) {
        return reply.code(404).send({ error: 'Product variant not found' });
      }

      const printSizeTiers = await prisma.printSizeTier.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          label: true,
          widthCm: true,
          heightCm: true,
          sortOrder: true,
        },
        orderBy: {
          sortOrder: 'asc',
        },
      });
      const addOnRules = await prisma.pricingRule.findMany({
        where: {
          isActive: true,
          ruleType: 'ADD_ON',
        },
        select: {
          id: true,
          name: true,
          price: true,
          minQuantity: true,
          maxQuantity: true,
          createdAt: true,
        },
        orderBy: [
          { createdAt: 'asc' },
          { name: 'asc' },
        ],
      });

      const configuredAreas = variant.product.printAreas.map((row) => ({
        id: row.printArea.id,
        name: row.printArea.name,
        label: row.printArea.label,
        labelEn: row.printArea.labelEn,
        maxWidthCm: Number(row.printArea.maxWidthCm),
        maxHeightCm: Number(row.printArea.maxHeightCm),
        sortOrder: row.printArea.sortOrder,
        isDefault: row.isDefault,
      }));

      const printAreas = configuredAreas.length > 0
        ? configuredAreas
        : (await prisma.printArea.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            label: true,
            labelEn: true,
            maxWidthCm: true,
            maxHeightCm: true,
            sortOrder: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
        })).map((area) => ({
          id: area.id,
          name: area.name,
          label: area.label,
          labelEn: area.labelEn,
          maxWidthCm: Number(area.maxWidthCm),
          maxHeightCm: Number(area.maxHeightCm),
          sortOrder: area.sortOrder,
          isDefault: false,
        }));

      const mockupPreviewEnabled = await settingsService.getMockupPreviewEnabled(
        String(variant.product.productFamily)
      );
      const showPlacementCoordinates = await settingsService.getPlacementCoordinatesEnabled();

      return reply.send({
        variantId: variant.id,
        productId: variant.product.id,
        isCustomizable: variant.product.isCustomizable,
        mockupPreviewEnabled,
        showPlacementCoordinates,
        layoutTemplate: (variant.product.metadata && typeof variant.product.metadata === 'object')
          ? ((variant.product.metadata as Record<string, unknown>).customizationTemplateV1 ?? null)
          : null,
        printAreas,
        printSizeTiers: printSizeTiers.map((tier) => ({
          id: tier.id,
          name: tier.name,
          label: tier.label,
          widthCm: Number(tier.widthCm),
          heightCm: Number(tier.heightCm),
          sortOrder: tier.sortOrder,
        })),
        addOnOptions: addOnRules.map((rule) => ({
          id: rule.id,
          name: rule.name,
          label: rule.name,
          fee: Number(rule.price),
          minQuantity: rule.minQuantity,
          maxQuantity: rule.maxQuantity,
        })),
      });
    } catch (error) {
      logger.error({ error, variantId }, 'Failed to load customization options');
      return reply.code(500).send({ error: 'Failed to load customization options' });
    }
  });

  app.post('/api/customization/upload-design', {
    preHandler: [userGuard],
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user.id;

    try {
      const file = await request.file();
      if (!file) {
        throw new BadRequestError('No file uploaded');
      }

      const buffer = await file.toBuffer();
      const asset = await uploadCustomizationAsset({
        userId,
        buffer,
        filename: file.filename || `design-${Date.now()}`,
        mimeType: file.mimetype || 'application/octet-stream',
      });

      return reply.code(201).send({
        asset: {
          id: asset.id,
          originalUrl: asset.originalUrl,
          thumbnailUrl: asset.thumbnailUrl,
          cloudinaryId: asset.cloudinaryId,
          widthPx: asset.widthPx,
          heightPx: asset.heightPx,
          dpi: asset.dpi,
          isValid: asset.isValid,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          fileSizeBytes: asset.fileSizeBytes,
          createdAt: asset.createdAt,
        },
      });
    } catch (error) {
      logger.error({ error, requestId: request.id, userIdHash: hashIdentifier(userId) ?? undefined }, 'Failed to upload customization asset');

      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({ error: error.message });
      }

      return reply.code(500).send({
        error: 'Failed to upload customization asset',
      });
    }
  });

  app.post('/api/customization/price-quote', {
    preHandler: [userGuard],
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    try {
      const validation = validateData(priceQuoteSchema, request.body, reply);
      if (!validation.success) {
        return;
      }


      const userId = (request as any).user.id;
      const userIdHash = hashIdentifier(userId) ?? undefined;
      logger.info({
        event: 'quote_requested',
        requestId: request.id,
        userIdHash,
        variantId: validation.data.variantId,
        quantity: validation.data.quantity,
        customizationCount: validation.data.customizations.length,
        addOnCount: (validation.data.addOnIds ?? []).length,
        rushOrder: Boolean(validation.data.rushOrder),
      }, '[Customization] quote_requested');
      const breakdown = await calculatePriceQuote(validation.data);
      return reply.send({ breakdown });
    } catch (error) {
      logger.error({ error }, 'Failed to calculate customization price quote');

      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({ error: error.message });
      }

      return reply.code(500).send({ error: 'Failed to calculate price quote' });
    }
  });

  app.post('/api/customization/mockup-preview', {
    preHandler: [userGuard],
    config: {
      rateLimit: {
        max: 40,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user.id;

    try {
      const validation = validateData(mockupPreviewSchema, request.body, reply);
      if (!validation.success) {
        return;
      }

      const {
        variantId,
        printAreaId,
        printSizeTierId,
        assetId,
        baseImageUrl,
        presetRectNorm,
        baseImageNaturalWidth,
        baseImageNaturalHeight,
        placementConfig,
      } = validation.data;

      const [variant, printArea, printSizeTier, asset] = await Promise.all([
        prisma.productVariant.findUnique({
          where: { id: variantId },
          select: {
            id: true,
            imagePath: true,
            product: {
              select: {
                id: true,
                isCustomizable: true,
                mockupImagePath: true,
                printAreas: {
                  select: { printAreaId: true },
                },
              },
            },
          },
        }),
        prisma.printArea.findFirst({
          where: {
            id: printAreaId,
            isActive: true,
          },
          select: {
            id: true,
            maxWidthCm: true,
            maxHeightCm: true,
          },
        }),
        printSizeTierId
          ? prisma.printSizeTier.findFirst({
            where: {
              id: printSizeTierId,
              isActive: true,
            },
            select: {
              id: true,
              widthCm: true,
              heightCm: true,
            },
          })
          : Promise.resolve(null),
        prisma.customizationAsset.findFirst({
          where: {
            id: assetId,
            userId,
            isValid: true,
          },
          select: {
            id: true,
            cloudinaryId: true,
            originalUrl: true,
          },
        }),
      ]);

      if (!variant) {
        return reply.code(404).send({ error: 'Product variant not found' });
      }

      if (!printArea) {
        throw new BadRequestError('Selected print area is invalid');
      }

      if (printSizeTierId && !printSizeTier) {
        throw new BadRequestError('Selected print size tier is invalid');
      }

      if (!asset) {
        throw new BadRequestError('Selected design asset is invalid');
      }

      if (!variant.product.isCustomizable) {
        throw new BadRequestError('Customization is not allowed for this product');
      }

      const configuredAreaIds = new Set(
        variant.product.printAreas.map((row) => row.printAreaId)
      );

      if (configuredAreaIds.size > 0 && !configuredAreaIds.has(printAreaId)) {
        throw new BadRequestError('Selected print area is not enabled for this product');
      }

      const fallbackBaseImageUrl = variant.product.mockupImagePath || variant.imagePath;
      const preferredBaseImageUrl = baseImageUrl?.includes('res.cloudinary.com')
        ? baseImageUrl
        : fallbackBaseImageUrl;

      if (!preferredBaseImageUrl) {
        throw new BadRequestError('Product variant does not have a base mockup image');
      }

      const overlayPublicId = asset.cloudinaryId?.trim();
      if (!overlayPublicId) {
        throw new BadRequestError('Design asset cannot be previewed yet');
      }

      const generated = buildCustomizationMockupPreviewUrl({
        baseImageUrl: preferredBaseImageUrl,
        overlayPublicId,
        printArea: {
          maxWidthCm: Number(printArea.maxWidthCm),
          maxHeightCm: Number(printArea.maxHeightCm),
        },
        printSizeTier: printSizeTier
          ? {
            widthCm: Number(printSizeTier.widthCm),
            heightCm: Number(printSizeTier.heightCm),
          }
          : undefined,
        presetRectNorm,
        baseImageNaturalWidth,
        baseImageNaturalHeight,
        placementConfig,
      });

      return reply.send({
        previewUrl: generated.previewUrl,
        baseImageUrl: preferredBaseImageUrl,
        overlay: {
          widthPx: generated.overlayWidthPx,
          heightPx: generated.overlayHeightPx,
          offsetXPx: generated.offsetXPx,
          offsetYPx: generated.offsetYPx,
        },
      });
    } catch (error) {
      logger.error({ error, requestId: request.id, userIdHash: hashIdentifier(userId) ?? undefined }, 'Failed to build customization mockup preview');

      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({ error: error.message });
      }

      return reply.code(500).send({ error: 'Failed to build mockup preview' });
    }
  });
}

