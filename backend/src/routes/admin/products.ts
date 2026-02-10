import { logger } from '../../lib/logger';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { adminGuard } from '../../supabaseauth';
import { prisma } from '../../lib/prisma';
import { productsCache } from '../../lib/cache';
import { deleteProductImages } from '../../lib/r2';
import { importRemoteImageToR2, isHttpUrl, isR2PublicUrl } from '../../lib/remote-image-import';

// price Decimal-д зориулж number/string аль алиныг зөвшөөрнө
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

const REMOTE_IMAGE_IMPORT_CONCURRENCY = (() => {
  const rawValue = Number(process.env.R2_REMOTE_IMPORT_CONCURRENCY ?? 4);
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

async function normalizeVariantMediaForR2(
  variants: VariantInput[],
  productId: string
): Promise<VariantInput[]> {
  const cache = new Map<string, string>();

  const collectRemoteUrls = (): string[] => {
    const uniqueRemoteUrls = new Set<string>();

    for (const variant of variants) {
      if (variant.imagePath && isHttpUrl(variant.imagePath) && !isR2PublicUrl(variant.imagePath)) {
        uniqueRemoteUrls.add(variant.imagePath);
      }

      for (const path of variant.galleryPaths ?? []) {
        if (isHttpUrl(path) && !isR2PublicUrl(path)) {
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
      const imported = await importRemoteImageToR2({ imageUrl: url, productId });
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
  // 🔐 Admin guard — бүх product route-д
  app.addHook('preHandler', adminGuard);

  // ➕ CREATE product with variants
  app.post('/', async (request, reply) => {
    const schema = z.object({
      title: z.string().min(1),
      slug: z.string().min(1),
      is_published: z.boolean().optional().default(false),
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
    const normalizedVariants = await normalizeVariantMediaForR2(body.variants, productId);

    const product = await prisma.product.create({
      data: {
        id: productId,
        title: body.title,
        slug: body.slug,
        is_published: body.is_published,
        subtitle: body.subtitle ?? null,
        description: body.description,
        basePrice: body.basePrice,
        categoryId: body.categoryId,
        rating: body.rating,
        reviews: body.reviews,
        features: body.features,
        benefits: body.benefits,
        productDetails: body.productDetails,
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

    productsCache.clear();
    return product;
  });

  // 📄 LIST products (pagination + search + filters + sorting) - OPTIMIZED
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

  // 🔎 GET by id with variants
  app.get('/:id', async (request, reply) => {
    const schema = z.object({ id: z.string().uuid() });
    const { id } = schema.parse(request.params);

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!product) return reply.status(404).send({ message: 'Not found' });
    return product;
  });

  // ✏️ UPDATE product with variants
  app.put('/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });

    const bodySchema = z.object({
      title: z.string().min(1).optional(),
      slug: z.string().min(1).optional(),
      is_published: z.boolean().optional(),
      subtitle: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      basePrice: priceSchema.optional(),
      categoryId: z.string().uuid().optional(),
      rating: z.number().min(0).max(5).optional(),
      reviews: z.number().int().min(0).optional(),
      features: z.array(z.string()).optional(),
      benefits: z.array(z.string()).optional(),
      productDetails: z.array(z.string()).optional(),
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

      normalizedVariants = await normalizeVariantMediaForR2(data.variants, id);

      // Delete old variants and create new ones
      await prisma.productVariant.deleteMany({ where: { productId: id } });
    }

    // Build update data - only include fields that are provided (not undefined)
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.is_published !== undefined) updateData.is_published = data.is_published;
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

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        variants: { orderBy: { sortOrder: 'asc' } },
      },
    });

    productsCache.clear();
    return updated;
  });

  // 🗑️ DELETE product (variants cascade deleted automatically)
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
        logger.info('[Delete Product] ❌ Product not found');
        return reply.status(404).send({ message: 'Product not found' });
      }

      logger.info({ title: product.title, variantCount: product.variants.length }, '[Delete Product] Product found');

      // Step 2: Delete all variant images from R2 storage
      logger.info('[Delete Product] Step 1: Deleting variant images from R2...');
      try {
        const deletedCount = await deleteProductImages(id);
        logger.info({ deletedCount }, '[Delete Product] Deleted files from R2');
      } catch (r2Error) {
        logger.error({ error: r2Error }, '[Delete Product] R2 deletion failed, but continuing...');
        // Continue even if R2 deletion fails - don't block product deletion
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
