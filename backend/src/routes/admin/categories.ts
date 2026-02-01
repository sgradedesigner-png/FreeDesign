import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminGuard } from '../../supabaseauth';
import { prisma } from '../../lib/prisma';

export async function adminCategoryRoutes(app: FastifyInstance) {
  // 🔐 Admin guard — бүх route-д
app.addHook('preHandler', adminGuard);

  // 📥 CREATE category
  app.post('/', async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
    });

    const { name, slug } = schema.parse(request.body);

    const exists = await prisma.category.findUnique({ where: { slug } });
    if (exists) {
      return reply.status(409).send({ message: 'Slug already exists' });
    }

    const category = await prisma.category.create({
      data: { name, slug },
    });

    return category;
  });

  // 📄 LIST categories
  app.get('/', async () => {
    return prisma.category.findMany({
      orderBy: { createdAt: 'desc' },
    });
  });

  // ✏️ UPDATE category
  app.put('/:id', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const bodySchema = z.object({
      name: z.string().min(1).optional(),
      slug: z.string().min(1).optional(),
    });

    const { id } = paramsSchema.parse(request.params);
    const data = bodySchema.parse(request.body);

    // ✅ Check slug uniqueness if changing
    if (data.slug) {
      const exists = await prisma.category.findUnique({
        where: { slug: data.slug }
      });

      if (exists && exists.id !== id) {
        return reply.status(409).send({
          message: 'Slug already exists'
        });
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data,
    });

    return category;
  });

  // 🗑️ DELETE category
  app.delete('/:id', async (request, reply) => {
    const schema = z.object({
      id: z.string().uuid(),
    });

    const { id } = schema.parse(request.params);

    // ✅ Check if category has products before deleting
    const productsCount = await prisma.product.count({
      where: { categoryId: id }
    });

    if (productsCount > 0) {
      return reply.status(400).send({
        message: `Cannot delete category. ${productsCount} product(s) are using this category.`
      });
    }

    await prisma.category.delete({ where: { id } });

    return { ok: true };
  });
}
