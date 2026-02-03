// Public product routes (no auth required)
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function publicProductRoutes(app: FastifyInstance) {
  // GET /api/categories - List categories with product count
  app.get('/categories', async (request, reply) => {
    try {
      const categories = await prisma.category.findMany({
        orderBy: {
          name: 'asc',
        },
      });

      // Get product count for each category
      const categoriesWithCount = await Promise.all(
        categories.map(async (category) => {
          const productCount = await prisma.product.count({
            where: { categoryId: category.id },
          });
          return {
            ...category,
            productCount,
          };
        })
      );

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
