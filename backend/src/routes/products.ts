// Public product routes (no auth required)
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma'; // Use shared singleton instance

export async function publicProductRoutes(app: FastifyInstance) {
  // GET /api/categories - List categories with product count
  app.get('/categories', async (request, reply) => {
    try {
      // Fetch categories and product counts in parallel (optimized)
      const [categories, productCounts] = await Promise.all([
        prisma.category.findMany({
          orderBy: {
            name: 'asc',
          },
        }),
        // Get product counts grouped by category in a single query
        prisma.product.groupBy({
          by: ['categoryId'],
          _count: {
            id: true
          }
        })
      ]);

      // Create a map of categoryId -> count for O(1) lookup
      const countMap = new Map(
        productCounts.map(item => [item.categoryId, item._count.id])
      );

      // Merge categories with their product counts
      const categoriesWithCount = categories.map(category => ({
        ...category,
        productCount: countMap.get(category.id) || 0,
      }));

      return reply.send(categoriesWithCount);
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch categories' });
    }
  });

  // GET /api/products/trending - Get trending products (most in-stock items as proxy)
  app.get('/trending', async (request, reply) => {
    try {
      const products = await prisma.product.findMany({
        take: 8,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          variants: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc', // Later can be replaced with actual order count
        },
      });

      return reply.send(products);
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch trending products' });
    }
  });

  // GET /api/products/new-arrivals - Get newest products
  app.get('/new-arrivals', async (request, reply) => {
    try {
      const products = await prisma.product.findMany({
        take: 8,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          variants: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return reply.send(products);
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch new arrivals' });
    }
  });

  // GET /api/products - List all products with variants
  app.get('/', async (request, reply) => {
    try {
      const products = await prisma.product.findMany({
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          variants: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return reply.send(products);
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch products' });
    }
  });

  // GET /api/products/:slug - Get single product by slug
  app.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    try {
      const product = await prisma.product.findUnique({
        where: { slug },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          variants: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
        },
      });

      if (!product) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      return reply.send(product);
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch product' });
    }
  });
}
