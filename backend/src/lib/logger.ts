import { createHash } from 'crypto';
import pino from 'pino';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Logger Configuration
 *
 * Development: Pretty printed, colorized, debug level
 * Production: JSON format, info level, with request IDs
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const isPrettyRequested = process.env.LOG_PRETTY === 'true';
const usePrettyLogging = isDevelopment || (isProduction && isPrettyRequested);
const colorizePretty = process.env.LOG_COLORIZE !== 'false';

const LOG_TAGS = {
  request: '[REQ]',
  response: '[RES]',
  database: '[DB]',
  payment: '[PAY]',
  qpay: '[QPAY]',
  circuit: '[CB]',
  security: '[SEC]',
  rateLimit: '[RATE]',
  ok: '[OK]',
  warn: '[WARN]',
  error: '[ERR]'
} as const;

// Base logger options
const baseOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Timestamp in ISO format
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,

  // Custom formatting
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
    bindings: (bindings: any) => {
      return {
        pid: bindings.pid,
        hostname: bindings.hostname,
        node_version: process.version
      };
    }
  },

  // Serialize errors properly
  serializers: {
    req: (req: any) => ({
      method: req.method,
      url: req.url,
      path: req.routeOptions?.url,
      parameters: req.params,
      headers: {
        host: req.headers.host,
        userAgent: req.headers['user-agent'],
        referer: req.headers.referer
      },
      remoteAddress: req.ip,
      remotePort: req.socket?.remotePort
    }),
    res: (res: any) => ({
      statusCode: res.statusCode,
      headers: {
        contentType: res.getHeader('content-type'),
        contentLength: res.getHeader('content-length')
      }
    }),
    err: pino.stdSerializers.err
  }
};

// Development transport (pretty printing)
const devTransport: pino.TransportSingleOptions = {
  target: 'pino-pretty',
  options: {
    colorize: colorizePretty,
    translateTime: 'SYS:HH:MM:ss.l',
    ignore: 'pid,hostname,node_version',
    singleLine: false,
    messageFormat: '{msg}',
    errorLikeObjectKeys: ['err', 'error']
  }
};

// Export logger configuration for Fastify
export const loggerConfig = usePrettyLogging
  ? { ...baseOptions, transport: devTransport }
  : baseOptions;

// Create logger instance
export const logger = usePrettyLogging
  ? pino({
      ...baseOptions,
      transport: devTransport
    })
  : pino(baseOptions);

/**
 * Create child logger with context
 */
export function createLogger(context: Record<string, any>) {
  return logger.child(context);
}

/**
 * Log request start
 */
export function logRequest(method: string, url: string, requestId: string) {
  logger.info({ method, url, requestId }, `${LOG_TAGS.request} Incoming request`);
}

/**
 * Log request completion
 */
export function logResponse(
  method: string,
  url: string,
  statusCode: number,
  responseTime: number,
  requestId: string
) {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  logger[level](
    {
      method,
      url,
      statusCode,
      responseTime: `${responseTime}ms`,
      requestId
    },
    `${LOG_TAGS.response} Request completed`
  );
}

/**
 * Log database query (for slow query detection)
 */
export function logQuery(query: string, duration: number, params?: any) {
  const isSlowQuery = duration > 1000; // > 1 second

  if (isSlowQuery) {
    logger.warn(
      {
        query,
        duration: `${duration}ms`,
        params: params ? JSON.stringify(params) : undefined
      },
      `${LOG_TAGS.database} ${LOG_TAGS.warn} Slow database query detected`
    );
  } else if (isDevelopment) {
    logger.debug(
      {
        query,
        duration: `${duration}ms`
      },
      `${LOG_TAGS.database} Query executed`
    );
  }
}

/**
 * Log payment operation
 */
export function logPayment(
  operation: string,
  orderId: string,
  amount?: number,
  status?: string,
  details?: Record<string, any>
) {
  logger.info(
    {
      operation,
      orderId,
      amount,
      status,
      ...details
    },
    `${LOG_TAGS.payment} ${operation}`
  );
}

/**
 * Log QPay operation
 */
export function logQPay(
  operation: string,
  invoiceId?: string,
  success: boolean = true,
  error?: any
) {
  const statusTag = success ? LOG_TAGS.ok : LOG_TAGS.error;
  const level = success ? 'info' : 'error';

  logger[level](
    {
      operation,
      invoiceId,
      success,
      error: error ? error.message : undefined
    },
    `${LOG_TAGS.qpay} ${statusTag} ${operation} ${success ? 'succeeded' : 'failed'}`
  );
}

/**
 * Log circuit breaker event
 */
export function logCircuitBreaker(
  operation: string,
  state: 'OPEN' | 'CLOSED' | 'HALF_OPEN',
  details?: Record<string, any>
) {
  const stateTag = state === 'CLOSED' ? LOG_TAGS.ok : state === 'OPEN' ? LOG_TAGS.error : LOG_TAGS.warn;
  const level = state === 'OPEN' ? 'error' : state === 'HALF_OPEN' ? 'warn' : 'info';

  logger[level](
    {
      operation,
      state,
      ...details
    },
    `${LOG_TAGS.circuit} ${stateTag} ${operation} -> ${state}`
  );
}

/**
 * Log security event
 */
export function logSecurity(
  event: string,
  severity: 'low' | 'medium' | 'high',
  details: Record<string, any>
) {
  const severityTag = severity === 'high' ? LOG_TAGS.error : severity === 'medium' ? LOG_TAGS.warn : LOG_TAGS.ok;
  const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';

  logger[level](
    {
      event,
      severity,
      ...details
    },
    `${LOG_TAGS.security} ${severityTag} ${event}`
  );
}

/**
 * Log rate limit event
 */
export function logRateLimit(ip: string, route: string, retryAfter: number) {
  logger.warn(
    {
      ip,
      route,
      retryAfter: `${retryAfter}s`
    },
    `${LOG_TAGS.rateLimit} ${LOG_TAGS.warn} Rate limit exceeded`
  );
}


/**
 * One-way hash for identifiers in logs (avoid printing raw user IDs/emails).
 *
 * Note: This is for observability correlation only, not for security.
 */
export function hashIdentifier(value: string | null | undefined): string | null {
  if (!value) return null;
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}
export default logger;

