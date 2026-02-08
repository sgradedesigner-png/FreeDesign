import { FastifyRequest, FastifyReply } from 'fastify';
import { logRequest, logResponse } from '../lib/logger';

/**
 * Request Logger Middleware
 *
 * Logs incoming requests and outgoing responses with timing information
 */
export async function requestLoggerMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const startTime = Date.now();
  const requestId = (request as any).id || 'unknown';

  // Log incoming request
  logRequest(request.method, request.url, requestId);

  // Add hook to log response
  reply.raw.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logResponse(
      request.method,
      request.url,
      reply.statusCode,
      responseTime,
      requestId
    );
  });
}

/**
 * Skip logging for certain routes (health checks, metrics)
 */
export function shouldSkipLogging(url: string): boolean {
  const skipPaths = [
    '/health',
    '/ready',
    '/metrics',
    '/favicon.ico'
  ];

  return skipPaths.some(path => url.startsWith(path));
}
