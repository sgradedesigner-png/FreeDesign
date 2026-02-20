import { logger } from '../../lib/logger';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { adminGuard } from '../../supabaseauth';
import { prisma } from '../../lib/prisma';
import { productsCache } from '../../lib/cache';
import { deleteFolder } from '../../lib/cloudinary';
import { importRemoteImageToCloudinary, isCloudinaryUrl, isHttpUrl } from '../../lib/remote-image-import';

// price Decimal-Ð´ Ð·Ð¾Ñ€Ð¸ÑƒÐ»Ð¶ number/string Ð°Ð»ÑŒ Ð°Ð»Ð¸Ð½Ñ‹Ð³ Ð·Ó©Ð²ÑˆÓ©Ó©Ñ€Ð½Ó©
const priceSchema = z.union([
  z.number(),
  z.string().regex(/^\d+(\.\d+)?$/, 'Invalid price format'),
]);

// Variant schema
const variantSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  price: priceSchema,
  originalPrice: priceSchema.optional().nullable(),
  sizes: z.array(z.string()).optional().default([]),
  imagePath: z.string().url().or(z.literal('')).optional().default(''),
  galleryPaths: z.array(z.string().url()).optional().default([]),
  stock: z.number().int().min(0).optional().default(0),
  isAvailable: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

type VariantInput = z.infer<typeof variantSchema>;

const productFamilySchema = z.enum([
  'BY_SIZE',
  'GANG_UPLOAD',
  'GANG_BUILDER',
  'BLANKS',
  'UV_BY_SIZE',
  'UV_GANG_UPLOAD',
  'UV_GANG_BUILDER',
]);

const layoutRectNormSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().gt(0).max(1),
  h: z.number().gt(0).max(1),
}).superRefine((value, ctx) => {
  if (value.x + value.w > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['w'],
      message: 'x + w must be <= 1',
    });
  }
  if (value.y + value.h > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['h'],
      message: 'y + h must be <= 1',
    });
  }
});

const layoutViewSchema = z.object({
  imagePath: z.string().optional(),
  naturalWidth: z.number().int().positive().optional(),
  naturalHeight: z.number().int().positive().optional(),
});

const customizationTemplateV1Schema = z.object({
  version: z.literal(1),
  views: z.object({
    front: layoutViewSchema.optional(),
    back: layoutViewSchema.optional(),
    left: layoutViewSchema.optional(),
    right: layoutViewSchema.optional(),
  }).default({}),
  presets: z.array(z.object({
    id: z.string().optional(),
    key: z.string().min(1),
    labelMn: z.string().optional(),
    labelEn: z.string().optional(),
    view: z.enum(['front', 'back', 'left', 'right']),
    rectNorm: layoutRectNormSchema,
    printAreaId: z.string().uuid().nullable().optional(),
    sortOrder: z.number().int().optional().default(0),
    isDefault: z.boolean().optional().default(false),
  })).default([]),
});

const REMOTE_IMAGE_IMPORT_CONCURRENCY = (() => {
  const rawValue = Number(process.env.REMOTE_IMAGE_IMPORT_CONCURRENCY ?? process.env.R2_REMOTE_IMPORT_CONCURRENCY ?? 4);
  if (!Number.isFinite(rawValue)) return 4;
  return Math.min(8, Math.max(1, Math.floor(rawValue)));
})();

async function runWithConcurrency<T>(
  items: T[],
  maxConcurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;

  const concurrency = Math.max(1, Math.min(maxConcurrency, items.length));
  let cursor = 0;

  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const currentIndex = cursor++;
      if (currentIndex >= items.length) break;
      await worker(items[currentIndex]!);
    }
  });

  await Promise.all(runners);
}

async function normalizeVariantMediaForCloudinary(
  variants: VariantInput[],
  productId: string
): Promise<VariantInput[]> {
  const cache = new Map<string, string>();

  const collectRemoteUrls = (): string[] => {
    const uniqueRemoteUrls = new Set<string>();

    for (const variant of variants) {
      if (variant.imagePath && isHttpUrl(variant.imagePath) && !isCloudinaryUrl(variant.imagePath)) {
        uniqueRemoteUrls.add(variant.imagePath);
      }

      for (const path of variant.galleryPaths ?? []) {
        if (isHttpUrl(path) && !isCloudinaryUrl(path)) {
          uniqueRemoteUrls.add(path);
        }
      }
    }

    return Array.from(uniqueRemoteUrls);
  };

  const remoteUrls = collectRemoteUrls();

  await runWithConcurrency(
    remoteUrls,
    REMOTE_IMAGE_IMPORT_CONCURRENCY,
    async (url) => {
      const imported = await importRemoteImageToCloudinary({ imageUrl: url, productId });
      cache.set(url, imported.publicUrl);
    }
  );

  const mapUrl = (url: string): string => cache.get(url) ?? url;

  const normalized: VariantInput[] = [];
  for (const variant of variants) {
    const imagePath = variant.imagePath ? mapUrl(variant.imagePath) : variant.imagePath;

    const importedGallery: string[] = [];
    const seen = new Set<string>();
    for (const path of variant.galleryPaths ?? []) {
      const mapped = mapUrl(path);
      if (seen.has(mapped)) continue;
      seen.add(mapped);
      importedGallery.push(mapped);
    }

    normalized.push({
      ...variant,
      imagePath,
      galleryPaths: importedGallery,
    });
  }

  return normalized;
}

export async function adminProductRoutes(app: FastifyInstance) {
  // ðŸ” Admin guard â€” Ð±Ò¯Ñ… product route-Ð´
  app.addHook('preHandler', adminGuard);

  // âž• CREATE product with variants
  app.post('/', async (request, reply) => {
    const schema = z.object({
      title: z.string().min(1),
      slug: z.string().min(1),
      is_published: z.boolean().optional().default(false),
      product_family: productFamilySchema.optional().default('BLANKS'),
      product_subfamily: z.string().trim().min(1).nullable().optional(),
      requires_upload: z.boolean().optional().default(false),
      requires_builder: z.boolean().optional().default(false),
      upload_profile_id: z.string().trim().min(1).nullable().optional(),
      subtitle: z.string().optional().nullable(),
      description: z.string().optional(),
      basePrice: priceSchema.optional().default(0),
      categoryId: z.string().uuid(),
      rating: z.number().min(0).max(5).optional().default(0),
      reviews: z.number().int().min(0).optional().default(0),
      features: z.array(z.string()).optional().default([]),
      benefits: z.array(z.string()).optional().default([]),
      productDetails: z.array(z.string()).optional().default([]),
      variants: z.array(variantSchema).min(1, 'At least one variant is required'),
      // Product wizard fields
      printAreas: z.array(z.string().uuid()).optional().default([]),
      printAreaDefaults: z.record(z.string(), z.boolean()).optional(),
      uploadConstraints: z.object({
        maxFileSizeMB: z.number(),
        minDPI: z.number().optional(),
        minWidth: z.number(),
        minHeight: z.number(),
        allowedFormats: z.array(z.string()),
      }).optional(),
      customizationTemplateV1: customizationTemplateV1Schema.optional().nullable(),
    });

    const body = schema.parse(request.body);

    // slug unique check
    const exists = await prisma.product.findUnique({ where: { slug: body.slug } });
    if (exists) return reply.status(409).send({ message: 'Slug already exists' });

    // category existence check
    const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
    if (!category) return reply.status(400).send({ message: 'Invalid categoryId' });

    // Check SKU uniqueness
    const skus = body.variants.map(v => v.sku);
    const existingSku = await prisma.productVariant.findFirst({
      where: { sku: { in: skus } }
    });
    if (existingSku) {
      return reply.status(409).send({ message: `SKU already exists: ${existingSku.sku}` });
    }

    const productId = randomUUID();
    const normalizedVariants = await normalizeVariantMediaForCloudinary(body.variants, productId);

    // Build metadata including upload constraints
    const metadata: Prisma.JsonObject = {};
    if (body.uploadConstraints) {
      metadata.uploadConstraints = body.uploadConstraints;
    }
    if (body.customizationTemplateV1) {
      metadata.customizationTemplateV1 = body.customizationTemplateV1;
    }

    const product = await prisma.product.create({
      data: {
        id: productId,
        title: body.title,
        slug: body.slug,
        is_published: body.is_published,
        productFamily: body.product_family,
        productSubfamily: body.product_subfamily ?? null,
        requiresUpload: body.requires_upload,
        requiresBuilder: body.requires_builder,
        uploadProfileId: body.upload_profile_id ?? null,
        subtitle: body.subtitle ?? null,
        description: body.description,
        basePrice: body.basePrice,
        categoryId: body.categoryId,
        rating: body.rating,
        reviews: body.reviews,
        features: body.features,
        benefits: body.benefits,
        productDetails: body.productDetails,
        metadata: metadata,
        variants: {
          create: normalizedVariants.map((v, index) => ({
            name: v.name,
            sku: v.sku,
            price: v.price,
            originalPrice: v.originalPrice || null,
            sizes: v.sizes,
            imagePath: v.imagePath,
            galleryPaths: v.galleryPaths,
            stock: v.stock,
            isAvailable: v.isAvailable,
            sortOrder: v.sortOrder ?? index,
          })),
        },
      },
      include: {
        variants: { orderBy: { sortOrder: 'asc' } },
        category: true,
      },
    });

    // Create print area links if provided
    if (body.printAreas && body.printAreas.length > 0) {
      await prisma.productPrintArea.createMany({
        data: body.printAreas.map((areaId) => ({
          productId: product.id,
          printAreaId: areaId,
          isDefault: body.printAreaDefaults?.[areaId] ?? false,
        })),
      });
    }

    productsCache.clear();
    return product;
  });

  // ðŸ“„ LIST products (pagination + search + filters + sorting) - OPTIMIZED
  app.get('/', async (request) => {
    const schema = z.object({
      q: z.string().optional(),
      page: z.coerce.number().int().min(1).optional().default(1),
      limit: z.coerce.number().int().min(1).max(1000).optional().default(20),
      categoryId: z.string().uuid().optional(),
      stock: z.enum(['all', 'in-stock', 'low-stock', 'out-of-stock']).optional().default('all'),
      sortBy: z.enum(['title', 'createdAt', 'category']).optional().default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    });

    const { q, page, limit, categoryId, stock, sortBy, sortOrder } = schema.parse(request.query);
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      ...(q && {
        OR: [
          { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { slug: { contains: q, mode: Prisma.QueryMode.insensitive } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(stock !== 'all' && {
        variants: {
          some: {
            stock: stock === 'in-stock'
              ? { gt: 0 }
              : stock === 'low-stock'
              ? { gt: 0, lt: 10 }
              : { equals: 0 },
          },
        },
      }),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sortBy === 'category'
        ? { category: { name: sortOrder } }
        : { [sortBy]: sortOrder };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          is_published: true,
          productFamily: true,
          categoryId: true,
          createdAt: true,
          updatedAt: true,
          category: {
            select: { id: true, name: true, slug: true },
          },
          variants: {
            select: {
              id: true,
              name: true,
              price: true,
              stock: true,
              imagePath: true,
            },
            orderBy: { sortOrder: 'asc' },
            take: 1, // Only first variant for list view
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  });

  // ðŸ”Ž GET by id with variants
  app.get('/:id', async (request, reply) => {
    const schema = z.object({ id: z.string().uuid() });
    const { id } = schema.parse(request.params);

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: { orderBy: { sortOrder: 'asc' } },
        printAreas: {
          select: {
            printAreaId: true,
            isDefault: true,
          },
          orderBy: { printArea: { sortOrder: 'asc' } },
        },
      },
    });

    if (!product) return reply.status(404).send({ message: 'Not found' });
    return product;
  });

  // âœï¸ UPDATE product with variants
  app.get('/:id/print-areas', async (request, reply) => {
    const schema = z.object({ id: z.string().uuid() });
    const { id } = schema.parse(request.params);

    const [product, availablePrintAreas] = await Promise.all([
      prisma.product.findUnique({
        where: { id },
        select: {
          id: true,
          isCustomizable: true,
          printAreas: {
            include: { printArea: true },
            orderBy: { printArea: { sortOrder: 'asc' } },
          },
        },
      }),
      prisma.printArea.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    if (!product) {
      return reply.status(404).send({ message: 'Product not found' });
    }

    return {
      productId: product.id,
      isCustomizable: product.isCustomizable,
      configuredPrintAreas: product.printAreas,
      availablePrintAreas,
    };
  });

  app.put('/:id/print-areas', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const bodySchema = z.object({
      printAreaIds: z.array(z.string().uuid()).max(10).default([]),
      defaultPrintAreaId: z.string().uuid().nullable().optional(),
      isCustomizable: z.boolean().optional(),
    });

    const { id } = paramsSchema.parse(request.params);
    const { printAreaIds, defaultPrintAreaId, isCustomizable } = bodySchema.parse(request.body);
    const uniquePrintAreaIds = Array.from(new Set(printAreaIds));

    if (defaultPrintAreaId && !uniquePrintAreaIds.includes(defaultPrintAreaId)) {
      return reply.status(400).send({
        message: 'defaultPrintAreaId must be included in printAreaIds',
      });
    }

    const [product, validAreaCount] = await Promise.all([
      prisma.product.findUnique({
        where: { id },
        select: { id: true },
      }),
      uniquePrintAreaIds.length > 0
        ? prisma.printArea.count({
          where: {
            id: { in: uniquePrintAreaIds },
            isActive: true,
          },
        })
        : Promise.resolve(0),
    ]);

    if (!product) {
      return reply.status(404).send({ message: 'Product not found' });
    }

    if (validAreaCount !== uniquePrintAreaIds.length) {
      return reply.status(400).send({ message: 'One or more print areas are invalid/inactive' });
    }

    const resolvedDefaultId =
      uniquePrintAreaIds.length === 0
        ? null
        : (defaultPrintAreaId ?? uniquePrintAreaIds[0]);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.productPrintArea.deleteMany({
        where: { productId: id },
      });

      if (uniquePrintAreaIds.length > 0) {
        await tx.productPrintArea.createMany({
          data: uniquePrintAreaIds.map((printAreaId) => ({
            productId: id,
            printAreaId,
            isDefault: printAreaId === resolvedDefaultId,
          })),
        });
      }

      await tx.product.update({
        where: { id },
        data: {
          isCustomizable: isCustomizable ?? uniquePrintAreaIds.length > 0,
        },
      });

      return tx.product.findUnique({
        where: { id },
        select: {
          id: true,
          isCustomizable: true,
          printAreas: {
            include: { printArea: true },
            orderBy: { printArea: { sortOrder: 'asc' } },
          },
        },
      });
    });

    return updated;
  });

  app.put('/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });

    const bodySchema = z.object({
      title: z.string().min(1).optional(),
      slug: z.string().min(1).optional(),
      is_published: z.boolean().optional(),
      product_family: productFamilySchema.optional(),
      product_subfamily: z.string().trim().min(1).nullable().optional(),
      requires_upload: z.boolean().optional(),
      requires_builder: z.boolean().optional(),
      upload_profile_id: z.string().trim().min(1).nullable().optional(),
      subtitle: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      basePrice: priceSchema.optional(),
      categoryId: z.string().uuid().optional(),
      rating: z.number().min(0).max(5).optional(),
      reviews: z.number().int().min(0).optional(),
      features: z.array(z.string()).optional(),
      benefits: z.array(z.string()).optional(),
      productDetails: z.array(z.string()).optional(),
      // Product wizard fields
      printAreas: z.array(z.string().uuid()).optional(),
      printAreaDefaults: z.record(z.string(), z.boolean()).optional(),
      uploadConstraints: z.object({
        maxFileSizeMB: z.number(),
        minDPI: z.number().optional(),
        minWidth: z.number(),
        minHeight: z.number(),
        allowedFormats: z.array(z.string()),
      }).optional(),
      customizationTemplateV1: customizationTemplateV1Schema.optional().nullable(),
      variants: z.array(variantSchema).optional(),
    });

    const { id } = paramsSchema.parse(request.params);
    const data = bodySchema.parse(request.body);
    let normalizedVariants: VariantInput[] | undefined;

    // slug uniqueness if changing
    if (data.slug) {
      const exists = await prisma.product.findUnique({ where: { slug: data.slug } });
      if (exists && exists.id !== id) {
        return reply.status(409).send({ message: 'Slug already exists' });
      }
    }

    // category existence if changing
    if (data.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category) return reply.status(400).send({ message: 'Invalid categoryId' });
    }

    // Check SKU uniqueness if variants provided
    if (data.variants) {
      const skus = data.variants.map(v => v.sku);
      const existingSku = await prisma.productVariant.findFirst({
        where: {
          sku: { in: skus },
          productId: { not: id }, // Exclude current product's variants
        }
      });
      if (existingSku) {
        return reply.status(409).send({ message: `SKU already exists: ${existingSku.sku}` });
      }

      normalizedVariants = await normalizeVariantMediaForCloudinary(data.variants, id);

      // Delete old variants and create new ones
      await prisma.productVariant.deleteMany({ where: { productId: id } });
    }

    // Build update data - only include fields that are provided (not undefined)
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.is_published !== undefined) updateData.is_published = data.is_published;
    if (data.product_family !== undefined) updateData.productFamily = data.product_family;
    if (data.product_subfamily !== undefined) updateData.productSubfamily = data.product_subfamily;
    if (data.requires_upload !== undefined) updateData.requiresUpload = data.requires_upload;
    if (data.requires_builder !== undefined) updateData.requiresBuilder = data.requires_builder;
    if (data.upload_profile_id !== undefined) updateData.uploadProfileId = data.upload_profile_id;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.basePrice !== undefined) updateData.basePrice = data.basePrice;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.rating !== undefined) updateData.rating = data.rating;
    if (data.reviews !== undefined) updateData.reviews = data.reviews;
    if (data.features !== undefined) updateData.features = data.features;
    if (data.benefits !== undefined) updateData.benefits = data.benefits;
    if (data.productDetails !== undefined) updateData.productDetails = data.productDetails;

    if (normalizedVariants) {
      updateData.variants = {
        create: normalizedVariants.map((v, index) => ({
          name: v.name,
          sku: v.sku,
          price: v.price,
          originalPrice: v.originalPrice || null,
          sizes: v.sizes,
          imagePath: v.imagePath,
          galleryPaths: v.galleryPaths,
          stock: v.stock,
          isAvailable: v.isAvailable,
          sortOrder: v.sortOrder ?? index,
        })),
      };
    }

    if (data.uploadConstraints !== undefined || data.customizationTemplateV1 !== undefined) {
      const existing = await prisma.product.findUnique({
        where: { id },
        select: { metadata: true },
      });
      const metadata = (existing?.metadata && typeof existing.metadata === 'object'
        ? { ...(existing.metadata as Prisma.JsonObject) }
        : {}) as Prisma.JsonObject;
      if (data.uploadConstraints !== undefined) {
        metadata.uploadConstraints = data.uploadConstraints as unknown as Prisma.JsonValue;
      }
      if (data.customizationTemplateV1 === null) {
        delete metadata.customizationTemplateV1;
      } else if (data.customizationTemplateV1 !== undefined) {
        metadata.customizationTemplateV1 = data.customizationTemplateV1 as unknown as Prisma.JsonValue;
      }
      updateData.metadata = metadata;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.product.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          variants: { orderBy: { sortOrder: 'asc' } },
        },
      });

      if (data.printAreas !== undefined) {
        const uniquePrintAreas = Array.from(new Set(data.printAreas));
        await tx.productPrintArea.deleteMany({ where: { productId: id } });
        if (uniquePrintAreas.length > 0) {
          await tx.productPrintArea.createMany({
            data: uniquePrintAreas.map((areaId) => ({
              productId: id,
              printAreaId: areaId,
              isDefault: data.printAreaDefaults?.[areaId] ?? false,
            })),
          });
        }
      }

      return saved;
    });

    productsCache.clear();
    return updated;
  });

  // ðŸ—‘ï¸ DELETE product (variants cascade deleted automatically)
  app.delete('/:id', async (request, reply) => {
    const schema = z.object({ id: z.string().uuid() });
    const { id } = schema.parse(request.params);

    logger.info({ productId: id }, '[Delete Product] DELETE PRODUCT REQUEST');

    try {
      // Step 1: Check if product exists and get variants
      const product = await prisma.product.findUnique({
        where: { id },
        include: { variants: true },
      });

      if (!product) {
        logger.info('[Delete Product] âŒ Product not found');
        return reply.status(404).send({ message: 'Product not found' });
      }

      logger.info({ title: product.title, variantCount: product.variants.length }, '[Delete Product] Product found');

      // Step 2: Delete all variant images from Cloudinary storage
      logger.info('[Delete Product] Step 1: Deleting variant images from Cloudinary...');
      try {
        await deleteFolder(`products/${id}`);
        logger.info('[Delete Product] Deleted product folder from Cloudinary');
      } catch (cloudinaryError) {
        logger.error({ error: cloudinaryError }, '[Delete Product] Cloudinary deletion failed, but continuing...');
        // Continue even if media cleanup fails - do not block product deletion
      }

      // Step 3: Delete product from database (variants auto-deleted via CASCADE)
      logger.info('[Delete Product] Step 2: Deleting product from database...');
      await prisma.product.delete({ where: { id } });
      logger.info('[Delete Product] Product and all variants deleted from database');

      productsCache.clear();
      logger.info('[Delete Product] DELETE COMPLETE');
      return {
        ok: true,
        message: 'Product, variants, and all associated images deleted successfully'
      };
    } catch (error) {
      logger.error({ error }, '[Delete Product] Delete failed');
      return reply.status(500).send({
        message: 'Failed to delete product',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
