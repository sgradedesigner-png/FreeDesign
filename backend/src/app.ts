import fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import csrf from '@fastify/csrf-protection';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// CRITICAL: Validate environment before anything else
import { validateEnv } from './lib/env';
validateEnv();

// Initialize Sentry (must be after env validation, before app code)
import { initSentry, captureException } from './lib/sentry';
initSentry();

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
import adminCronRoutes from './routes/admin/cron';
import { prisma } from './lib/prisma'; // Use shared singleton instance
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logRateLimit, logger } from './lib/logger'; // Use shared logger instance
import { cronService } from './services/cron.service';

const isDevelopment = process.env.NODE_ENV === 'development';

// Use shared logger instance (already configured for dev/prod)
const app = fastify({
  logger: logger, // Single source of truth for logging
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'], // Allow CSRF token header
});

// Register multipart for file uploads
app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Register compression (Phase 3.4 - Performance Optimization)
// Compresses responses > 1KB using gzip/brotli
app.register(compress, {
  global: true, // Apply to all routes
  threshold: 1024, // Only compress responses > 1KB
  encodings: ['gzip', 'deflate'], // Support both gzip and deflate
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

// Register cookie plugin (required for CSRF protection)
app.register(cookie, {
  secret: process.env.COOKIE_SECRET || 'change-this-to-a-random-string-in-production',
  parseOptions: {}
});

// Register CSRF protection
app.register(csrf, {
  // Use cookie-based tokens (more secure for SPA)
  cookieOpts: {
    signed: true,
    sameSite: 'strict', // Prevent CSRF from external sites
    httpOnly: true,     // Prevent XSS attacks
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    path: '/'
  },
  // Session key for CSRF token
  sessionPlugin: '@fastify/cookie'
});

// Security Headers - Protect against common web vulnerabilities
// Applied to all responses via onSend hook
app.addHook('onSend', async (request, reply) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Prevent clickjacking attacks
  reply.header('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  reply.header('X-Content-Type-Options', 'nosniff');

  // Enable XSS filter in older browsers
  reply.header('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict browser features
  reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // HSTS - Force HTTPS (production only)
  if (isProduction) {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content Security Policy - Restrict resource loading
  // Allows: self, Supabase, Cloudflare Turnstile, inline styles (for React)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ];

  // In development, allow all for easier debugging
  if (isDevelopment) {
    reply.header('Content-Security-Policy-Report-Only', cspDirectives.join('; '));
  } else {
    reply.header('Content-Security-Policy', cspDirectives.join('; '));
  }
});

// 2) Public routes
app.get('/', async () => ({ message: 'eCommerce API is running correctly! 🚀' }));

// CSRF token endpoint - Frontend can fetch this token before making state-changing requests
app.get('/csrf-token', async (request, reply) => {
  const token = await reply.generateCsrf();
  return { csrfToken: token };
});

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
app.register(adminCronRoutes);
app.register(testEmailRoutes);

// 7) Error Handlers
// Set custom error handler with Sentry integration
app.setErrorHandler((error, request, reply) => {
  // Log error locally
  request.log.error({
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
  }, 'Request error');

  // Send to Sentry (production monitoring)
  captureException(error, {
    url: request.url,
    method: request.method,
    userId: (request as any).user?.id,
    requestId: request.id,
  });

  // Use existing error handler for response
  return errorHandler(error, request, reply);
});

// Set custom 404 handler (handles routes that don't exist)
app.setNotFoundHandler(notFoundHandler);

// 8) Start Server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Server is running at http://localhost:${port}`);

    // Start cron jobs for email notifications (Phase 2)
    await cronService.start();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  app.log.info('SIGTERM signal received: closing HTTP server and stopping cron jobs');
  cronService.stop();
  await app.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  app.log.info('SIGINT signal received: closing HTTP server and stopping cron jobs');
  cronService.stop();
  await app.close();
  process.exit(0);
});

start();
