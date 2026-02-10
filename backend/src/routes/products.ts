// Public product routes (no auth required)
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma'; // Use shared singleton instance
import { productsCache, getProductsCacheKey } from '../lib/cache'; // Phase 4: Response cache

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
  // Query params: ?page=1&limit=20&category_id=xxx&is_published=true&include_total=true
  app.get('/', async (request, reply) => {
    try {
      // VERIFICATION: Performance diagnostic mode (DEV/TEST only)
      const perfDiag = process.env.PERF_DIAG === 'true' || process.env.NODE_ENV !== 'production';
      const requestStart = perfDiag ? Date.now() : 0;

      const query = request.query as {
        page?: string;
        limit?: string;
        category_id?: string;
        is_published?: string;
        include_total?: string; // Phase 2: Optional total count
      };

      // Parse pagination parameters
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10))); // Max 100, min 1, default 20
      const skip = (page - 1) * limit;

      // Phase 2: Only run COUNT if explicitly requested
      const includeTotal = query.include_total === 'true';

      // Phase 4: Check cache first (only for requests without include_total)
      const cacheEnabled = process.env.ENABLE_RESPONSE_CACHE !== 'false';
      const cacheKey = getProductsCacheKey({ page, limit, category_id: query.category_id, is_published: query.is_published });

      if (cacheEnabled && !includeTotal) {
        const cached = productsCache.get(cacheKey);
        if (cached) {
          // VERIFICATION: Measure actual cache HIT time (DEV/TEST only)
          if (perfDiag) {
            const totalTime = Date.now() - requestStart;
            reply.header('X-PERF-TOTAL-MS', totalTime.toString());
            reply.header('X-PERF-DB-MS', '0'); // Cache hit, no DB
            reply.header('X-PERF-QUERY-COUNT', '0');
            reply.header('X-PERF-CACHE', 'HIT');
            reply.header('X-Cache', 'HIT');
            reply.header('X-DB-Time', '0ms'); // No DB query
            reply.header('X-Total-Time', '0ms');
            reply.header('X-Query-Count', '0');
          }
          return reply.send(cached);
        }
      }

      // Build where clause for filtering
      const where: any = {};
      if (query.category_id) {
        where.categoryId = query.category_id;
      }
      if (query.is_published !== undefined) {
        where.is_published = query.is_published === 'true';
      }

      // Phase 1 & 2: Add diagnostic timing (cache MISS path)
      const dbStart = perfDiag ? Date.now() : 0;

      // Phase 2 & 3: Lazy COUNT + Optimized variant loading
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
            // Phase 3: Only load essential variant fields for list view
            variants: {
              select: {
                id: true,
                name: true,
                price: true,
                originalPrice: true,
                imagePath: true, // Only main image, not galleryPaths
                stock: true,
                isAvailable: true,
                sortOrder: true,
                sizes: true, // Keep sizes for product cards
                sku: true, // Keep SKU for reference
              },
              orderBy: {
                sortOrder: 'asc',
              },
              take: 3, // Phase 3: Limit to first 3 variants for list view
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        includeTotal ? prisma.product.count({ where }) : Promise.resolve(null),
      ]);

      const dbTime = perfDiag ? Date.now() - dbStart : 0;
      const totalTime = perfDiag ? Date.now() - requestStart : 0;

      // Phase 2: Calculate pagination with heuristics when COUNT not available
      const hasNextPage = products.length === limit; // If we got full page, likely more exist
      const hasPrevPage = page > 1;
      const totalPages = totalCount !== null ? Math.ceil(totalCount / limit) : undefined;

      // Phase 4: Build response object
      const responseData = {
        products,
        pagination: {
          page,
          limit,
          totalCount: totalCount ?? undefined, // undefined if not requested
          totalPages, // undefined if totalCount not available
          hasNextPage,
          hasPrevPage,
        },
      };

      // Phase 4: Store in cache (only for requests without include_total)
      if (cacheEnabled && !includeTotal) {
        productsCache.set(cacheKey, responseData);
      }

      // VERIFICATION: Add performance diagnostic headers (DEV/TEST only)
      if (perfDiag) {
        reply.header('X-PERF-TOTAL-MS', totalTime.toString());
        reply.header('X-PERF-DB-MS', dbTime.toString());
        reply.header('X-PERF-QUERY-COUNT', includeTotal ? '2' : '1');
        reply.header('X-PERF-CACHE', 'MISS');
        reply.header('X-DB-Time', `${dbTime}ms`);
        reply.header('X-Total-Time', `${totalTime}ms`);
        reply.header('X-Query-Count', includeTotal ? '2' : '1');
        reply.header('X-Cache', 'MISS');
      }

      // Phase 2: Return paginated response with optional totalCount
      return reply.send(responseData);
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
