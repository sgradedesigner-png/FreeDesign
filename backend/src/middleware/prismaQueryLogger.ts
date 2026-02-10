import { Prisma } from '@prisma/client';
import { logQuery } from '../lib/logger';

/**
 * Prisma Middleware for Query Logging and Performance Monitoring
 *
 * Automatically logs:
 * - Slow queries (> 1000ms)
 * - All queries in development mode (debug level)
 * - Query duration and parameters
 * - Separate tracking for COUNT queries (Phase 1: Diagnostic)
 * - VERIFICATION: Enhanced logging when PERF_DIAG=true (DEV/TEST only)
 */
export const prismaQueryLogger: Prisma.Middleware = async (params, next) => {
  const startTime = Date.now();

  // Execute the query
  const result = await next(params);

  const duration = Date.now() - startTime;
  const query = `${params.model}.${params.action}`;

  // Phase 1: Flag COUNT queries for performance analysis
  const isCountQuery = params.action === 'count';
  const queryType = isCountQuery ? 'COUNT' : params.action;

  // VERIFICATION: Enhanced diagnostic logging (DEV/TEST only)
  const perfDiag = process.env.PERF_DIAG === 'true' || process.env.NODE_ENV !== 'production';
  if (perfDiag && params.model === 'Product') {
    logQuery(`[PERF_DIAG] Product.${params.action}`, duration);
  }

  // Log query with duration and params
  logQuery(query, duration, {
    model: params.model,
    action: params.action,
    queryType, // Phase 1: Add query type for diagnostics
    isCountQuery, // Phase 1: Flag COUNT queries
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
