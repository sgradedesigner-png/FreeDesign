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

  // GET /api/products - List all products with variants (Phase 3.4 - Pagination)
  // Query params: ?page=1&limit=20&category_id=xxx&is_published=true
  app.get('/', async (request, reply) => {
    try {
      const query = request.query as {
        page?: string;
        limit?: string;
        category_id?: string;
        is_published?: string;
      };

      // Parse pagination parameters
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10))); // Max 100, min 1, default 20
      const skip = (page - 1) * limit;

      // Build where clause for filtering
      const where: any = {};
      if (query.category_id) {
        where.categoryId = query.category_id;
      }
      if (query.is_published !== undefined) {
        where.is_published = query.is_published === 'true';
      }

      // Fetch products and total count in parallel (optimized)
      const [products, totalCount] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: limit,
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
        }),
        prisma.product.count({ where }),
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      // Return paginated response
      return reply.send({
        products,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      });
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
