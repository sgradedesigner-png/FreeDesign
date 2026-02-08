import { Prisma } from '@prisma/client';
import { logQuery } from '../lib/logger';

/**
 * Prisma Middleware for Query Logging and Performance Monitoring
 *
 * Automatically logs:
 * - Slow queries (> 1000ms)
 * - All queries in development mode (debug level)
 * - Query duration and parameters
 */
export const prismaQueryLogger: Prisma.Middleware = async (params, next) => {
  const startTime = Date.now();

  // Execute the query
  const result = await next(params);

  const duration = Date.now() - startTime;
  const query = `${params.model}.${params.action}`;

  // Log query with duration and params
  logQuery(query, duration, {
    model: params.model,
    action: params.action,
    args: process.env.NODE_ENV === 'development' ? params.args : undefined
  });

  return result;
};

/**
 * Apply Prisma middleware for query logging
 *
 * Usage:
 * ```typescript
 * import { prisma } from './lib/prisma';
 * import { prismaQueryLogger } from './middleware/prismaQueryLogger';
 *
 * prisma.$use(prismaQueryLogger);
 * ```
 */
