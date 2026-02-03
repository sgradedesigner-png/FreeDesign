import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { adminGuard } from '../../supabaseauth';
import { prisma } from '../../lib/prisma';
import { deleteProductImages } from '../../lib/r2';

// price Decimal-д зориулж number/string аль алиныг зөвшөөрнө
const priceSchema = z.union([
  z.number(),
  z.string().regex(/^\d+(\.\d+)?$/, 'Invalid price format'),
]);

export async function adminProductRoutes(app: FastifyInstance) {
  // 🔐 Admin guard — бүх product route-д
app.addHook('preHandler', adminGuard);

  // ➕ CREATE product
  app.post('/', async (request, reply) => {
    const schema = z.object({
      title: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().optional(),
      price: priceSchema,
      stock: z.number().int().min(0).optional().default(0),
      images: z.array(z.string().url()).optional().default([]),
      categoryId: z.string().uuid(),
    });

    const body = schema.parse(request.body);

    // slug unique check
    const exists = await prisma.product.findUnique({ where: { slug: body.slug } });
    if (exists) return reply.status(409).send({ message: 'Slug already exists' });

    // category existence check
    const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
    if (!category) return reply.status(400).send({ message: 'Invalid categoryId' });

    const product = await prisma.product.create({
      data: {
        title: body.title,
        slug: body.slug,
        description: body.description,
        price: typeof body.price === 'string' ? body.price : body.price, // Prisma Decimal accepts string/number
        stock: body.stock,
        images: body.images,
        categoryId: body.categoryId,
      },
    });

    return product;
  });

  // 📄 LIST products (pagination + search)
  app.get('/', async (request) => {
    const schema = z.object({
      q: z.string().optional(),
      page: z.coerce.number().int().min(1).optional().default(1),
      limit: z.coerce.number().int().min(1).max(1000).optional().default(20), // Increased to 1000 for dashboard stats
    });

    const { q, page, limit } = schema.parse(request.query);
    const skip = (page - 1) * limit;

 const where: Prisma.ProductWhereInput = q
  ? {
      OR: [
        { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { slug: { contains: q, mode: Prisma.QueryMode.insensitive } },
      ],
    }
  : {};


    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { category: true },
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

  // 🔎 GET by id
  app.get('/:id', async (request, reply) => {
    const schema = z.object({ id: z.string().uuid() });
    const { id } = schema.parse(request.params);

    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) return reply.status(404).send({ message: 'Not found' });
    return product;
  });

  // ✏️ UPDATE product
  app.put('/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });

    const bodySchema = z.object({
      title: z.string().min(1).optional(),
      slug: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      price: priceSchema.optional(),
      stock: z.number().int().min(0).optional(),
      images: z.array(z.string().url()).optional(),
      categoryId: z.string().uuid().optional(),
    });

    const { id } = paramsSchema.parse(request.params);
    const data = bodySchema.parse(request.body);

    // slug uniqueness if changing
    if (data.slug) {
      const exists = await prisma.product.findUnique({ where: { slug: data.slug } });
      if (exists && exists.id !== id) return reply.status(409).send({ message: 'Slug already exists' });
    }

    // category existence if changing
    if (data.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category) return reply.status(400).send({ message: 'Invalid categoryId' });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...data,
        price: data.price, // ✅ Prisma accepts both string and number
      },
      include: { category: true },
    });

    return updated;
  });

  // 🗑️ DELETE product
  app.delete('/:id', async (request, reply) => {
    const schema = z.object({ id: z.string().uuid() });
    const { id } = schema.parse(request.params);

    console.log('\n[Delete Product] ========== DELETE PRODUCT REQUEST ==========');
    console.log('[Delete Product] Product ID:', id);

    try {
      // Step 1: Check if product exists
      const product = await prisma.product.findUnique({ where: { id } });

      if (!product) {
        console.log('[Delete Product] ❌ Product not found');
        return reply.status(404).send({ message: 'Product not found' });
      }

      console.log('[Delete Product] ✅ Product found:', product.title);
      console.log('[Delete Product] Images:', product.images?.length || 0);

      // Step 2: Delete all images from R2 storage
      if (product.images && product.images.length > 0) {
        console.log('[Delete Product] Step 1: Deleting images from R2...');
        try {
          const deletedCount = await deleteProductImages(id);
          console.log('[Delete Product] ✅ Deleted', deletedCount, 'files from R2');
        } catch (r2Error) {
          console.error('[Delete Product] ⚠️ R2 deletion failed, but continuing...', r2Error);
          // Continue even if R2 deletion fails - don't block product deletion
        }
      } else {
        console.log('[Delete Product] No images to delete from R2');
      }

      // Step 3: Delete product from database
      console.log('[Delete Product] Step 2: Deleting product from database...');
      await prisma.product.delete({ where: { id } });
      console.log('[Delete Product] ✅ Product deleted from database');

      console.log('[Delete Product] ========== DELETE COMPLETE ==========\n');
      return {
        ok: true,
        message: 'Product and all associated images deleted successfully'
      };
    } catch (error) {
      console.error('[Delete Product] ❌ Delete failed');
      console.error('[Delete Product] Error:', error);
      return reply.status(500).send({
        message: 'Failed to delete product',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
