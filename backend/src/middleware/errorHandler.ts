import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../utils/errors';
import { hashIdentifier } from '../lib/logger';

/**
 * Comprehensive Error Handler Middleware
 * Handles all types of errors with appropriate responses
 */
export async function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Log error with context
  request.log.error({
    err: error,
    method: request.method,
    url: request.url,
    route: request.routeOptions?.url,
    requestId: request.id,
    userIdHash: hashIdentifier(((request as any).user?.id as string | undefined)) ?? undefined,
    body: summarizeBody(request.body),
    queryKeys: summarizeKeys(request.query),
    params: request.params
  }, 'Request error occurred');

  // 1. Custom Application Errors
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.constructor.name,
      message: error.message,
      details: error instanceof ValidationError ? error.details : (isDevelopment ? {
        stack: error.stack
      } : undefined),
      statusCode: error.statusCode
    });
  }

  // 2. Zod Validation Errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: 'ÐžÑ€ÑƒÑƒÐ»ÑÐ°Ð½ Ó©Ð³Ó©Ð³Ð´Ó©Ð» Ð±ÑƒÑ€ÑƒÑƒ Ð±Ð°Ð¹Ð½Ð°',
      details: error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      })),
      statusCode: 400
    });
  }

  // 3. Prisma Database Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        const target = (error.meta?.target as string[]) || [];
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Ð”Ð°Ð²Ñ…Ð°Ñ€Ð´ÑÐ°Ð½ ÑƒÑ‚Ð³Ð° Ð±Ð°Ð¹Ð½Ð°',
          details: isDevelopment ? {
            fields: target,
            constraint: error.meta?.constraint
          } : undefined,
          statusCode: 409
        });

      case 'P2025': // Record not found
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Ó¨Ð³Ó©Ð³Ð´Ó©Ð» Ð¾Ð»Ð´ÑÐ¾Ð½Ð³Ò¯Ð¹',
          details: isDevelopment ? error.meta : undefined,
          statusCode: 404
        });

      case 'P2003': // Foreign key constraint violation
        return reply.status(400).send({
          error: 'Foreign Key Constraint',
          message: 'Ð¥Ð¾Ð»Ð±Ð¾Ð¾Ñ‚Ð¾Ð¹ Ó©Ð³Ó©Ð³Ð´Ó©Ð» Ð¾Ð»Ð´ÑÐ¾Ð½Ð³Ò¯Ð¹',
          details: isDevelopment ? {
            field: error.meta?.field_name
          } : undefined,
          statusCode: 400
        });

      case 'P2014': // Invalid ID
        return reply.status(400).send({
          error: 'Invalid ID',
          message: 'Ð‘ÑƒÑ€ÑƒÑƒ ID Ñ„Ð¾Ñ€Ð¼Ð°Ñ‚',
          statusCode: 400
        });

      case 'P2024': // Timed out fetching from database
        return reply.status(504).send({
          error: 'Database Timeout',
          message: 'Ó¨Ð³Ó©Ð³Ð´Ð»Ð¸Ð¹Ð½ ÑÐ°Ð½Ð´ Ñ…Ð¾Ð»Ð±Ð¾Ð³Ð´Ð¾Ñ… Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð° Ð´ÑƒÑƒÑÐ»Ð°Ð°. Ð”Ð°Ñ…Ð¸Ð½ Ð¾Ñ€Ð¾Ð»Ð´Ð¾Ð½Ð¾ ÑƒÑƒ.',
          statusCode: 504
        });

      default:
        return reply.status(500).send({
          error: 'Database Error',
          message: 'Ó¨Ð³Ó©Ð³Ð´Ð»Ð¸Ð¹Ð½ ÑÐ°Ð½Ð´ Ð°Ð»Ð´Ð°Ð° Ð³Ð°Ñ€Ð»Ð°Ð°',
          details: isDevelopment ? {
            code: error.code,
            meta: error.meta,
            message: error.message
          } : undefined,
          statusCode: 500
        });
    }
  }

  // 4. Prisma Client Initialization Errors
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return reply.status(503).send({
      error: 'Database Connection Error',
      message: 'Ó¨Ð³Ó©Ð³Ð´Ð»Ð¸Ð¹Ð½ ÑÐ°Ð½Ð´ Ñ…Ð¾Ð»Ð±Ð¾Ð³Ð´Ð¾Ð¶ Ñ‡Ð°Ð´ÑÐ°Ð½Ð³Ò¯Ð¹',
      details: isDevelopment ? error.message : undefined,
      statusCode: 503
    });
  }

  // 5. Prisma Client Validation Errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: 'Ð‘ÑƒÑ€ÑƒÑƒ Ó©Ð³Ó©Ð³Ð´Ó©Ð»',
      details: isDevelopment ? error.message : undefined,
      statusCode: 400
    });
  }

  // 6. Rate Limit Errors
  if ((error as any).statusCode === 429) {
    return reply.status(429).send({
      error: 'Rate Limit Exceeded',
      message: 'Ð¥ÑÑ‚ Ð¾Ð»Ð¾Ð½ Ñ…Ò¯ÑÑÐ»Ñ‚ Ð¸Ð»Ð³ÑÑÑÑÐ½ Ð±Ð°Ð¹Ð½Ð°. Ð¢Ò¯Ñ€ Ñ…Ò¯Ð»ÑÑÐ³ÑÑÐ´ Ð´Ð°Ñ…Ð¸Ð½ Ð¾Ñ€Ð¾Ð»Ð´Ð¾Ð½Ð¾ ÑƒÑƒ.',
      retryAfter: (error as any).retryAfter,
      statusCode: 429
    });
  }

  // 7. Fastify Errors (includes statusCode)
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    const statusCode = error.statusCode;

    // Map common HTTP status codes to Mongolian messages
    const messageMap: Record<number, string> = {
      400: 'Ð‘ÑƒÑ€ÑƒÑƒ Ñ…Ò¯ÑÑÐ»Ñ‚',
      401: 'ÐÑÐ²Ñ‚Ñ€ÑÑ… ÑˆÐ°Ð°Ñ€Ð´Ð»Ð°Ð³Ð°Ñ‚Ð°Ð¹',
      403: 'Ð¥Ð°Ð½Ð´Ð°Ñ… ÑÑ€Ñ…Ð³Ò¯Ð¹ Ð±Ð°Ð¹Ð½Ð°',
      404: 'ÐžÐ»Ð´ÑÐ¾Ð½Ð³Ò¯Ð¹',
      405: 'Ð­Ð½Ñ Ð°Ñ€Ð³Ð° Ñ…Ò¯ÑÑÐ»Ñ‚ Ð·Ó©Ð²ÑˆÓ©Ó©Ñ€Ó©Ð³Ð´Ó©Ó©Ð³Ò¯Ð¹',
      408: 'Ð¥ÑƒÐ³Ð°Ñ†Ð°Ð° Ñ…ÑÑ‚ÑÑ€ÑÑÐ½',
      409: 'Ð—Ó©Ñ€Ñ‡Ð¸Ð»Ð´Ó©Ó©Ð½',
      413: 'Ð¥Ò¯ÑÑÐ»Ñ‚ Ñ…ÑÑ‚ Ñ‚Ð¾Ð¼ Ð±Ð°Ð¹Ð½Ð°',
      415: 'Ð”ÑÐ¼Ð¶Ð¸Ð³Ð´ÑÑÐ³Ò¯Ð¹ Ð¼ÐµÐ´Ð¸Ð° Ñ‚Ó©Ñ€Ó©Ð»',
      422: 'Ð‘Ð¾Ð»Ð¾Ð²ÑÑ€ÑƒÑƒÐ»Ð°Ñ… Ð±Ð¾Ð»Ð¾Ð¼Ð¶Ð³Ò¯Ð¹',
      429: 'Ð¥ÑÑ‚ Ð¾Ð»Ð¾Ð½ Ñ…Ò¯ÑÑÐ»Ñ‚',
      500: 'Ð¡ÐµÑ€Ð²ÐµÑ€Ð¸Ð¹Ð½ Ð°Ð»Ð´Ð°Ð°',
      502: 'ÐœÑƒÑƒ Ð³Ð°Ñ€Ñ†',
      503: 'Ò®Ð¹Ð»Ñ‡Ð¸Ð»Ð³ÑÑ Ð±Ð¾Ð»Ð¾Ð¼Ð¶Ð³Ò¯Ð¹',
      504: 'Ð“Ð°Ñ€Ñ†Ñ‹Ð½ Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð° Ð´ÑƒÑƒÑÑÐ°Ð½'
    };

    return reply.status(statusCode).send({
      error: error.name || 'Error',
      message: messageMap[statusCode] || error.message,
      details: isDevelopment ? {
        originalMessage: error.message,
        stack: error.stack
      } : undefined,
      statusCode
    });
  }

  // 8. Generic Error instances (with message property)
  if (error instanceof Error) {
    // Check for specific error messages that need special handling

    // QPay related errors
    if (error.message.includes('QPay') || error.message.includes('qpay')) {
      return reply.status(503).send({
        error: 'Payment Service Error',
        message: 'Ð¢Ó©Ð»Ð±Ó©Ñ€Ð¸Ð¹Ð½ ÑÐ¸ÑÑ‚ÐµÐ¼ Ñ‚Ò¯Ñ€ Ð°ÑˆÐ¸Ð³Ð»Ð°Ñ… Ð±Ð¾Ð»Ð¾Ð¼Ð¶Ð³Ò¯Ð¹ Ð±Ð°Ð¹Ð½Ð°. Ð”Ð°Ñ€Ð°Ð° Ð´Ð°Ñ…Ð¸Ð½ Ð¾Ñ€Ð¾Ð»Ð´Ð¾Ð½Ð¾ ÑƒÑƒ.',
        details: isDevelopment ? error.message : undefined,
        statusCode: 503
      });
    }

    // Timeout errors
    if (error.message.toLowerCase().includes('timeout')) {
      return reply.status(408).send({
        error: 'Timeout',
        message: 'Ð¥ÑƒÐ³Ð°Ñ†Ð°Ð° Ñ…ÑÑ‚ÑÑ€ÑÑÐ½. Ð”Ð°Ñ…Ð¸Ð½ Ð¾Ñ€Ð¾Ð»Ð´Ð¾Ð½Ð¾ ÑƒÑƒ.',
        details: isDevelopment ? error.message : undefined,
        statusCode: 408
      });
    }

    // Network/Connection errors
    if (error.message.toLowerCase().includes('network') ||
        error.message.toLowerCase().includes('connection')) {
      return reply.status(503).send({
        error: 'Network Error',
        message: 'Ð¡Ò¯Ð»Ð¶ÑÑÐ½Ð¸Ð¹ Ð°Ð»Ð´Ð°Ð° Ð³Ð°Ñ€Ð»Ð°Ð°. Ð”Ð°Ñ…Ð¸Ð½ Ð¾Ñ€Ð¾Ð»Ð´Ð¾Ð½Ð¾ ÑƒÑƒ.',
        details: isDevelopment ? error.message : undefined,
        statusCode: 503
      });
    }

    // Generic error
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Ð¡ÐµÑ€Ð²ÐµÑ€Ñ‚ Ð°Ð»Ð´Ð°Ð° Ð³Ð°Ñ€Ð»Ð°Ð°',
      details: isDevelopment ? {
        message: error.message,
        stack: error.stack
      } : undefined,
      statusCode: 500
    });
  }

  // 9. Unknown errors (fallback)
  return reply.status(500).send({
    error: 'Unknown Error',
    message: 'Ð¢Ð¾Ð´Ð¾Ñ€Ñ…Ð¾Ð¹Ð³Ò¯Ð¹ Ð°Ð»Ð´Ð°Ð° Ð³Ð°Ñ€Ð»Ð°Ð°',
    details: isDevelopment ? String(error) : undefined,
    statusCode: 500
  });
}

/**
 * Not Found Handler (404)
 * Called when no route matches the request
 */
export async function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  return reply.status(404).send({
    error: 'Not Found',
    message: `${request.method} ${request.url} Ð¾Ð»Ð´ÑÐ¾Ð½Ð³Ò¯Ð¹`,
    statusCode: 404
  });
}
function summarizeKeys(value: unknown): string[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.keys(value as Record<string, unknown>).slice(0, 40);
}

function summarizeBody(body: unknown): Record<string, unknown> | null {
  if (body == null) return null;
  if (typeof body === 'string') return { type: 'string', length: body.length };
  if (Array.isArray(body)) return { type: 'array', length: body.length };
  if (typeof body === 'object') return { type: 'object', keys: summarizeKeys(body) };
  return { type: typeof body };
}


