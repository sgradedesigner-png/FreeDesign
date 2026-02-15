import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Phase 1: Database-backed collections with product associations
export default async function collectionsRoutes(app: FastifyInstance) {
  // List all active collections
  app.get(
    '/api/collections',
    {
      schema: {
        description: 'List active collections',
        tags: ['Products'],
      },
    },
    async (_request, reply) => {
      const collections = await prisma.collection.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          metadata: true,
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
    '/api/collections/:slug',
    {
      schema: {
        description: 'Get collection by slug with products',
        tags: ['Products'],
      },
    },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };

      const collection = await prisma.collection.findUnique({
        where: { slug, isActive: true },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          metadata: true,
          products: {
            where: {
              product: {
                is_published: true,
              },
            },
            orderBy: { sortOrder: 'asc' },
            select: {
              product: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  subtitle: true,
                  description: true,
                  basePrice: true,
                  mockupImagePath: true,
                  productFamily: true,
                  rating: true,
                  reviews: true,
                  categoryId: true,
                  category: {
                    select: {
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!collection) {
        return reply.code(404).send({ error: 'Collection not found' });
      }

      // Flatten products for easier frontend consumption
      const products = collection.products.map((cp) => cp.product);

      return reply.send({
        collection: {
          ...collection,
          products,
          productCount: products.length,
        },
      });
    }
  );
}
