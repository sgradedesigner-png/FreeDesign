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
      message: 'Оруулсан өгөгдөл буруу байна',
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
          message: 'Давхардсан утга байна',
          details: isDevelopment ? {
            fields: target,
            constraint: error.meta?.constraint
          } : undefined,
          statusCode: 409
        });

      case 'P2025': // Record not found
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Өгөгдөл олдсонгүй',
          details: isDevelopment ? error.meta : undefined,
          statusCode: 404
        });

      case 'P2003': // Foreign key constraint violation
        return reply.status(400).send({
          error: 'Foreign Key Constraint',
          message: 'Холбоотой өгөгдөл олдсонгүй',
          details: isDevelopment ? {
            field: error.meta?.field_name
          } : undefined,
          statusCode: 400
        });

      case 'P2014': // Invalid ID
        return reply.status(400).send({
          error: 'Invalid ID',
          message: 'Буруу ID формат',
          statusCode: 400
        });

      case 'P2024': // Timed out fetching from database
        return reply.status(504).send({
          error: 'Database Timeout',
          message: 'Өгөгдлийн санд холбогдох хугацаа дууслаа. Дахин оролдоно уу.',
          statusCode: 504
        });

      default:
        return reply.status(500).send({
          error: 'Database Error',
          message: 'Өгөгдлийн санд алдаа гарлаа',
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
      message: 'Өгөгдлийн санд холбогдож чадсангүй',
      details: isDevelopment ? error.message : undefined,
      statusCode: 503
    });
  }

  // 5. Prisma Client Validation Errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: 'Буруу өгөгдөл',
      details: isDevelopment ? error.message : undefined,
      statusCode: 400
    });
  }

  // 6. Rate Limit Errors
  if ((error as any).statusCode === 429) {
    return reply.status(429).send({
      error: 'Rate Limit Exceeded',
      message: 'Хэт олон хүсэлт илгээсэн байна. Түр хүлээгээд дахин оролдоно уу.',
      retryAfter: (error as any).retryAfter,
      statusCode: 429
    });
  }

  // 7. Fastify Errors (includes statusCode)
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    const statusCode = error.statusCode;

    // Map common HTTP status codes to Mongolian messages
    const messageMap: Record<number, string> = {
      400: 'Буруу хүсэлт',
      401: 'Нэвтрэх шаардлагатай',
      403: 'Хандах эрхгүй байна',
      404: 'Олдсонгүй',
      405: 'Энэ арга хүсэлт зөвшөөрөгдөөгүй',
      408: 'Хугацаа хэтэрсэн',
      409: 'Зөрчилдөөн',
      413: 'Хүсэлт хэт том байна',
      415: 'Дэмжигдээгүй медиа төрөл',
      422: 'Боловсруулах боломжгүй',
      429: 'Хэт олон хүсэлт',
      500: 'Серверийн алдаа',
      502: 'Муу гарц',
      503: 'Үйлчилгээ боломжгүй',
      504: 'Гарцын хугацаа дууссан'
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
        message: 'Төлбөрийн систем түр ашиглах боломжгүй байна. Дараа дахин оролдоно уу.',
        details: isDevelopment ? error.message : undefined,
        statusCode: 503
      });
    }

    // Timeout errors
    if (error.message.toLowerCase().includes('timeout')) {
      return reply.status(408).send({
        error: 'Timeout',
        message: 'Хугацаа хэтэрсэн. Дахин оролдоно уу.',
        details: isDevelopment ? error.message : undefined,
        statusCode: 408
      });
    }

    // Network/Connection errors
    if (error.message.toLowerCase().includes('network') ||
        error.message.toLowerCase().includes('connection')) {
      return reply.status(503).send({
        error: 'Network Error',
        message: 'Сүлжээний алдаа гарлаа. Дахин оролдоно уу.',
        details: isDevelopment ? error.message : undefined,
        statusCode: 503
      });
    }

    // Generic error
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Серверт алдаа гарлаа',
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
    message: 'Тодорхойгүй алдаа гарлаа',
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
    message: `${request.method} ${request.url} олдсонгүй`,
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


