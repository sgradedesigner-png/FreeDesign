import type { FastifyInstance } from 'fastify';
import { PrismaClient, Prisma } from '@prisma/client';
import { adminGuard } from '../../supabaseauth';

const prisma = new PrismaClient();

// Admin-only collections management
export default async function adminCollectionsRoutes(app: FastifyInstance) {
  // Apply admin guard to all routes
  app.addHook('preHandler', adminGuard);

  // List all collections (including inactive)
  app.get(
    '/api/admin/collections',
    {
      schema: {
        description: 'List all collections (admin)',
        tags: ['Admin'],
      },
    },
    async (_request, reply) => {
      const collections = await prisma.collection.findMany({
        orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }],
        include: {
          _count: {
            select: { products: true },
          },
        },
      });
      return reply.send({ collections });
    }
  );

  // Get single collection with products
  app.get(
    '/api/admin/collections/:id',
    {
      schema: {
        description: 'Get collection by ID with products (admin)',
        tags: ['Admin'],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const collection = await prisma.collection.findUnique({
        where: { id },
        include: {
          products: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  mockupImagePath: true,
                  is_published: true,
                },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      if (!collection) {
        return reply.code(404).send({ error: 'Collection not found' });
      }

      return reply.send({ collection });
    }
  );

  // Create collection
  app.post(
    '/api/admin/collections',
    {
      schema: {
        description: 'Create a new collection (admin)',
        tags: ['Admin'],
        body: {
          type: 'object',
          required: ['name', 'slug'],
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            isActive: { type: 'boolean' },
            sortOrder: { type: 'number' },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      const { name, slug, description, isActive, sortOrder, metadata } = request.body as {
        name: string;
        slug: string;
        description?: string;
        isActive?: boolean;
        sortOrder?: number;
        metadata?: Record<string, unknown>;
      };

      // Validate slug format (lowercase, alphanumeric + hyphens)
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return reply.code(400).send({ error: 'Slug must be lowercase alphanumeric with hyphens only' });
      }

      try {
        const collection = await prisma.collection.create({
          data: {
            name,
            slug,
            description,
            isActive: isActive ?? true,
            sortOrder: sortOrder ?? 0,
            metadata: (metadata ?? {}) as Prisma.InputJsonValue,
          },
        });

        return reply.code(201).send({ collection });
      } catch (error: any) {
        if (error.code === 'P2002') {
          return reply.code(409).send({ error: 'Collection with this slug already exists' });
        }
        throw error;
      }
    }
  );

  // Update collection
  app.put(
    '/api/admin/collections/:id',
    {
      schema: {
        description: 'Update collection (admin)',
        tags: ['Admin'],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { name, slug, description, isActive, sortOrder, metadata } = request.body as {
        name?: string;
        slug?: string;
        description?: string;
        isActive?: boolean;
        sortOrder?: number;
        metadata?: Record<string, unknown>;
      };

      // Validate slug if provided
      if (slug && !/^[a-z0-9-]+$/.test(slug)) {
        return reply.code(400).send({ error: 'Slug must be lowercase alphanumeric with hyphens only' });
      }

      try {
        const collection = await prisma.collection.update({
          where: { id },
          data: {
            ...(name !== undefined && { name }),
            ...(slug !== undefined && { slug }),
            ...(description !== undefined && { description }),
            ...(isActive !== undefined && { isActive }),
            ...(sortOrder !== undefined && { sortOrder }),
            ...(metadata !== undefined && { metadata: metadata as Prisma.InputJsonValue }),
          },
        });

        return reply.send({ collection });
      } catch (error: any) {
        if (error.code === 'P2025') {
          return reply.code(404).send({ error: 'Collection not found' });
        }
        if (error.code === 'P2002') {
          return reply.code(409).send({ error: 'Collection with this slug already exists' });
        }
        throw error;
      }
    }
  );

  // Delete collection
  app.delete(
    '/api/admin/collections/:id',
    {
      schema: {
        description: 'Delete collection (admin)',
        tags: ['Admin'],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await prisma.collection.delete({
          where: { id },
        });

        return reply.send({ success: true });
      } catch (error: any) {
        if (error.code === 'P2025') {
          return reply.code(404).send({ error: 'Collection not found' });
        }
        throw error;
      }
    }
  );

  // Add product to collection
  app.post(
    '/api/admin/collections/:id/products',
    {
      schema: {
        description: 'Add product to collection (admin)',
        tags: ['Admin'],
        body: {
          type: 'object',
          required: ['productId'],
          properties: {
            productId: { type: 'string' },
            sortOrder: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { productId, sortOrder } = request.body as { productId: string; sortOrder?: number };

      try {
        const collectionProduct = await prisma.collectionProduct.create({
          data: {
            collectionId: id,
            productId,
            sortOrder: sortOrder ?? 0,
          },
        });

        return reply.code(201).send({ collectionProduct });
      } catch (error: any) {
        if (error.code === 'P2002') {
          return reply.code(409).send({ error: 'Product already in collection' });
        }
        if (error.code === 'P2003') {
          return reply.code(404).send({ error: 'Collection or product not found' });
        }
        throw error;
      }
    }
  );

  // Remove product from collection
  app.delete(
    '/api/admin/collections/:id/products/:productId',
    {
      schema: {
        description: 'Remove product from collection (admin)',
        tags: ['Admin'],
      },
    },
    async (request, reply) => {
      const { id, productId } = request.params as { id: string; productId: string };

      try {
        await prisma.collectionProduct.deleteMany({
          where: {
            collectionId: id,
            productId,
          },
        });

        return reply.send({ success: true });
      } catch (error: any) {
        throw error;
      }
    }
  );

  // Reorder products in collection
  app.put(
    '/api/admin/collections/:id/products/reorder',
    {
      schema: {
        description: 'Reorder products in collection (admin)',
        tags: ['Admin'],
        body: {
          type: 'object',
          required: ['productIds'],
          properties: {
            productIds: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { productIds } = request.body as { productIds: string[] };

      // Update sort order for each product
      const updates = productIds.map((productId, index) =>
        prisma.collectionProduct.updateMany({
          where: {
            collectionId: id,
            productId,
          },
          data: {
            sortOrder: index,
          },
        })
      );

      await prisma.$transaction(updates);

      return reply.send({ success: true });
    }
  );
}
