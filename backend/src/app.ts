import fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import dotenv from 'dotenv';

import { adminCategoryRoutes } from './routes/admin/categories';
import { adminProductRoutes } from './routes/admin/products';
import { adminPrefillRoutes } from './routes/admin/prefill';
import { adminStatsRoutes } from './routes/admin/stats';
import { adminUploadRoutes } from './routes/admin/upload';
import { adminUploadPresignedRoutes } from './routes/admin/upload-presigned';
import { publicProductRoutes } from './routes/products';
import { adminGuard } from './supabaseauth';
import orderRoutes from './routes/orders';
import profileRoutes from './routes/profile';
import paymentRoutes from './routes/payment';
import adminOrderRoutes from './routes/admin/orders';
import testEmailRoutes from './routes/test-email';
import { prisma } from './lib/prisma'; // Use shared singleton instance
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logRateLimit } from './lib/logger';
import pino from 'pino';

dotenv.config();

const isDevelopment = process.env.NODE_ENV === 'development';

const app = fastify({
  logger: isDevelopment ? {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname',
      }
    },
    level: 'debug'
  } : {
    level: 'info'
  },
  disableRequestLogging: false,
  requestIdLogLabel: 'requestId',
  genReqId: () => {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
});

// 1) Plugins
const defaultAllowedOrigins = [
  'http://localhost:5173', // Store (default Vite port)
  'http://localhost:5174', // Store/Admin (next Vite port)
  'http://localhost:5175', // Store/Admin (next Vite port)
  'http://localhost:5176', // Store/Admin (next Vite port)
  'http://localhost:3001', // Admin Panel (main port)
];

const envAllowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([...defaultAllowedOrigins, ...envAllowedOrigins])
);

app.register(cors, {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Explicitly allow all methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow required headers
});

// Register multipart for file uploads
app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Register rate limiting
app.register(rateLimit, {
  global: true, // Apply to all routes by default
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per window
  timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  cache: 10000, // Cache up to 10k different IPs
  allowList: ['127.0.0.1', '::1'], // Whitelist localhost
  skipOnError: false, // Don't skip rate limiting on errors

  // Custom key generator (uses IP address)
  keyGenerator: (request) => {
    return request.ip;
  },

  // Custom error response
  errorResponseBuilder: (request, context) => {
    // Log rate limit event
    const retryAfter = typeof context.after === 'string' ? parseInt(context.after, 10) : context.after;
    logRateLimit(request.ip, request.url, retryAfter);

    return {
      error: 'Rate limit exceeded',
      message: `Хэт олон хүсэлт илгээсэн байна. ${context.after} секундын дараа дахин оролдоно уу.`,
      retryAfter: context.after,
      statusCode: 429
    };
  },

  // Add rate limit headers to response
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
    'retry-after': true
  }
});

// 2) Public routes
app.get('/', async () => ({ message: 'eCommerce API is running correctly! 🚀' }));

// Health check endpoint - detailed health status
app.get('/health', async (_request, reply) => {
  const { checkDatabaseHealth, getDatabaseMetrics } = await import('./lib/prisma');

  const dbHealthy = await checkDatabaseHealth();
  const metrics = await getDatabaseMetrics();

  if (!dbHealthy) {
    return reply.status(503).send({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: metrics.error
      }
    });
  }

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: {
      connected: true,
      activeConnections: metrics.activeConnections
    },
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
});

// Readiness check endpoint - for Kubernetes/Docker
// Returns 200 only when the app is ready to serve traffic
app.get('/ready', async (_request, reply) => {
  const { checkDatabaseHealth } = await import('./lib/prisma');

  const dbHealthy = await checkDatabaseHealth();

  if (!dbHealthy) {
    return reply.status(503).send({ ready: false, reason: 'database_disconnected' });
  }

  return { ready: true };
});

// Metrics endpoint - for monitoring systems
app.get('/metrics', async (_request, reply) => {
  const { getDatabaseMetrics } = await import('./lib/prisma');

  const dbMetrics = await getDatabaseMetrics();

  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: process.memoryUsage().rss,
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external
    },
    database: {
      healthy: dbMetrics.healthy,
      activeConnections: dbMetrics.activeConnections,
      error: dbMetrics.error
    },
    process: {
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version
    }
  };
});

// Circuit Breaker Status endpoint - monitor QPay circuit breakers
app.get('/circuit-breakers', async (_request, reply) => {
  const { qpayCircuitBreaker } = await import('./services/qpay-circuit-breaker.service');

  const stats = qpayCircuitBreaker.getStats();
  const anyOpen = qpayCircuitBreaker.isAnyCircuitOpen();

  return {
    timestamp: new Date().toISOString(),
    anyCircuitOpen: anyOpen,
    status: anyOpen ? 'degraded' : 'healthy',
    circuits: stats
  };
});

// 3) Protected test route (ADMIN)
app.get('/admin/ping', { preHandler: adminGuard }, async (req) => {
  return { ok: true, user: (req as any).user };
});

// 4) Public API routes
app.register(publicProductRoutes, { prefix: '/api/products' });

// 5) Authenticated customer routes
app.register(orderRoutes);
app.register(profileRoutes);
app.register(paymentRoutes);

// 6) Admin routes
app.register(adminCategoryRoutes, { prefix: '/admin/categories' });
app.register(adminProductRoutes, { prefix: '/admin/products' });
app.register(adminPrefillRoutes, { prefix: '/admin/prefill' });
app.register(adminStatsRoutes, { prefix: '/admin/stats' });
app.register(adminUploadRoutes, { prefix: '/admin/upload' });
app.register(adminUploadPresignedRoutes, { prefix: '/admin/upload' });
app.register(adminOrderRoutes);
app.register(testEmailRoutes);

// 7) Error Handlers
// Set custom error handler (handles all errors thrown in routes)
app.setErrorHandler(errorHandler);

// Set custom 404 handler (handles routes that don't exist)
app.setNotFoundHandler(notFoundHandler);

// 8) Start Server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Server is running at http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
