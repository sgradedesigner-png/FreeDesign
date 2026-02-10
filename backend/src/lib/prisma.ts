import { logger } from '../lib/logger';
import { PrismaClient } from '@prisma/client';
import { prismaQueryLogger } from '../middleware/prismaQueryLogger';

/**
 * Singleton PrismaClient instance to prevent connection pool exhaustion
 *
 * In development, we use global to prevent HMR (hot module reload) from creating
 * multiple instances. In production, we create a single instance.
 *
 * Connection pool is configured via DATABASE_URL query parameters:
 * - connection_limit: Maximum number of connections (default: 10, recommended: 20 for production)
 * - pool_timeout: Maximum time to wait for a connection (seconds, default: 10)
 * - connect_timeout: Maximum time to wait for initial connection (seconds, default: 5)
 *
 * Example DATABASE_URL:
 * postgresql://user:password@host:5432/db?connection_limit=20&pool_timeout=10&connect_timeout=5
 */

// Extend global namespace to include prisma for development hot reload
declare global {
  var prisma: PrismaClient | undefined;
}

// Create or reuse PrismaClient instance
export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

// Apply query logging middleware
prisma.$use(prismaQueryLogger);

// In development, save to global to prevent multiple instances during HMR
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Graceful shutdown handlers
 * Ensures database connections are properly closed when the server shuts down
 */
const shutdown = async (signal: string) => {
  logger.info(`\n${signal} received. Closing database connections...`);
  try {
    await prisma.$disconnect();
    logger.info('✅ Database connections closed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error closing database connections:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));  // Ctrl+C
process.on('SIGTERM', () => shutdown('SIGTERM')); // Kubernetes/Docker stop
process.on('SIGUSR2', () => shutdown('SIGUSR2')); // Nodemon restart

/**
 * Health check helper function
 * Tests database connectivity with a simple query
 *
 * @returns Promise<boolean> - true if database is reachable, false otherwise
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Get database connection pool status
 * Useful for monitoring and debugging
 */
export async function getDatabaseMetrics() {
  try {
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM pg_stat_activity
      WHERE datname = current_database()
    `;
    return {
      activeConnections: Number(result[0]?.count || 0),
      healthy: true
    };
  } catch (error) {
    return {
      activeConnections: 0,
      healthy: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

