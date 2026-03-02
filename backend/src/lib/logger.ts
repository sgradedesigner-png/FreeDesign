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
const useIcons = process.env.LOG_ICONS === 'true';

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

const LOG_ICONS = {
  request: '🛰️',
  response: '📨',
  database: '🗄️',
  payment: '💳',
  qpay: '🧾',
  circuit: '🚦',
  security: '🔐',
  rateLimit: '🚫',
  ok: '✅',
  warn: '⚠️',
  error: '❌'
} as const;

function withTag(tag: keyof typeof LOG_TAGS, text: string): string {
  const iconPart = useIcons ? `${LOG_ICONS[tag]} ` : '';
  return `${iconPart}${LOG_TAGS[tag]} ${text}`;
}

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
  logger.info({ method, url, requestId }, withTag('request', 'Incoming request'));
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
    withTag('response', 'Request completed')
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
      `${withTag('database', `${LOG_TAGS.warn} Slow database query detected`)}`
    );
  } else if (isDevelopment) {
    logger.debug(
      {
        query,
        duration: `${duration}ms`
      },
      withTag('database', 'Query executed')
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
    withTag('payment', operation)
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
  const statusTag = success ? (useIcons ? LOG_ICONS.ok : LOG_TAGS.ok) : (useIcons ? LOG_ICONS.error : LOG_TAGS.error);
  const level = success ? 'info' : 'error';

  logger[level](
    {
      operation,
      invoiceId,
      success,
      error: error ? error.message : undefined
    },
    withTag('qpay', `${statusTag} ${operation} ${success ? 'succeeded' : 'failed'}`)
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
  const stateTag = state === 'CLOSED'
    ? (useIcons ? LOG_ICONS.ok : LOG_TAGS.ok)
    : state === 'OPEN'
      ? (useIcons ? LOG_ICONS.error : LOG_TAGS.error)
      : (useIcons ? LOG_ICONS.warn : LOG_TAGS.warn);
  const level = state === 'OPEN' ? 'error' : state === 'HALF_OPEN' ? 'warn' : 'info';

  logger[level](
    {
      operation,
      state,
      ...details
    },
    withTag('circuit', `${stateTag} ${operation} -> ${state}`)
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
  const severityTag = severity === 'high'
    ? (useIcons ? LOG_ICONS.error : LOG_TAGS.error)
    : severity === 'medium'
      ? (useIcons ? LOG_ICONS.warn : LOG_TAGS.warn)
      : (useIcons ? LOG_ICONS.ok : LOG_TAGS.ok);
  const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';

  logger[level](
    {
      event,
      severity,
      ...details
    },
    withTag('security', `${severityTag} ${event}`)
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
    withTag('rateLimit', `${useIcons ? LOG_ICONS.warn : LOG_TAGS.warn} Rate limit exceeded`)
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

