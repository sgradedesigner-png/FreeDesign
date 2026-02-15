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

  // Get single collection with products (with filtering support)
  app.get(
    '/api/collections/:slug',
    {
      schema: {
        description: 'Get collection by slug with products and optional filters',
        tags: ['Products'],
        querystring: {
          type: 'object',
          properties: {
            size: { type: 'string' },
            in_stock: { type: 'boolean' },
            sort: { type: 'string', enum: ['newest', 'price-low', 'price-high'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const { size, in_stock, sort } = request.query as {
        size?: string;
        in_stock?: boolean;
        sort?: 'newest' | 'price-low' | 'price-high';
      };

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
                  variants: {
                    select: {
                      id: true,
                      name: true,
                      sku: true,
                      price: true,
                      originalPrice: true,
                      sizes: true,
                      imagePath: true,
                      stock: true,
                      isAvailable: true,
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

      // Flatten products
      let products = collection.products.map((cp) => cp.product);

      // Apply filters
      if (size) {
        products = products.filter((p) =>
          p.variants?.some((v) => v.sizes.includes(size))
        );
      }

      if (in_stock) {
        products = products.filter((p) =>
          p.variants?.some((v) => v.stock > 0 && v.isAvailable)
        );
      }

      // Apply sorting
      if (sort === 'price-low') {
        products.sort((a, b) => {
          const aPrice = a.variants?.[0]?.price || a.basePrice;
          const bPrice = b.variants?.[0]?.price || b.basePrice;
          return Number(aPrice) - Number(bPrice);
        });
      } else if (sort === 'price-high') {
        products.sort((a, b) => {
          const aPrice = a.variants?.[0]?.price || a.basePrice;
          const bPrice = b.variants?.[0]?.price || b.basePrice;
          return Number(bPrice) - Number(aPrice);
        });
      }
      // Default sort is by collection sortOrder (already applied in query)

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
