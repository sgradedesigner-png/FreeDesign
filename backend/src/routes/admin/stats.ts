import { logger } from '../../lib/logger';
import type { FastifyInstance } from 'fastify';
import { adminGuard } from '../../supabaseauth';
import { prisma } from '../../lib/prisma';

export async function adminStatsRoutes(app: FastifyInstance) {
  // 🔐 Admin guard
  app.addHook('preHandler', adminGuard);

  // 📊 GET dashboard stats (optimized with aggregations)
  app.get('/', async () => {
    logger.info('[Stats] Fetching dashboard statistics...');

    const [
      productsCount,
      categoriesCount,
      categoryDistribution,
      recentProducts,
      inventoryValue,
    ] = await Promise.all([
      // Total products count
      prisma.product.count(),

      // Total categories count
      prisma.category.count(),

      // Category distribution (aggregated)
      prisma.product.groupBy({
        by: ['categoryId'],
        _count: { id: true },
      }).then(async (groups) => {
        const categoryIds = groups.map(g => g.categoryId);
        const categories = await prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        });
        const categoryMap = new Map(categories.map(c => [c.id, c.name]));
        return groups.map(g => ({
          name: categoryMap.get(g.categoryId) || 'Unknown',
          value: g._count.id,
        }));
      }),

      // Recent 5 products
      prisma.product.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          categoryId: true,
          createdAt: true,
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
            take: 1,
          },
        },
      }),

      // Total inventory value (sum of all variant price * stock)
      prisma.productVariant.aggregate({
        _sum: {
          stock: true,
        },
      }).then(async (result) => {
        // Get sum of (price * stock) using raw query for performance
        const rawResult = await prisma.$queryRaw<[{ total: bigint }]>`
          SELECT CAST(SUM(CAST(price AS DECIMAL) * stock) AS BIGINT) as total
          FROM product_variants
        `;
        return Number(rawResult[0]?.total || 0);
      }),
    ]);

    logger.info({ productsCount, categoriesCount, inventoryValue }, '[Stats] Statistics fetched successfully');

    return {
      productsCount,
      categoriesCount,
      totalRevenue: inventoryValue,
      categoryDistribution,
      recentProducts,
    };
  });
}
