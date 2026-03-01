import fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import csrf from '@fastify/csrf-protection';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
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
import adminPricingRoutes from './routes/admin/pricing';
import adminProductionRoutes from './routes/admin/production';
import adminCollectionsRoutes from './routes/admin/collections';
import { adminUploadsRoutes } from './routes/admin/uploads'; // P2-07: Upload moderation
import { adminPrintAreaRoutes } from './routes/admin/print-areas'; // Product wizard
import { adminSizeTierRoutes } from './routes/admin/size-tiers'; // Product wizard
import { adminLayoutTemplateRoutes } from './routes/admin/layout-template'; // BLANKS layout authoring
import { adminReprintRoutes } from './routes/admin/reprints'; // P3-05: Reprint queue
import { adminSettingsRoutes } from './routes/admin/settings';
import { publicProductRoutes } from './routes/products';
import collectionsRoutes from './routes/collections';
import pricingPublicRoutes from './routes/pricing-public';
import { adminGuard } from './supabaseauth';
import orderRoutes from './routes/orders';
import profileRoutes from './routes/profile';
import paymentRoutes from './routes/payment';
import customizationRoutes from './routes/customization';
import uploadRoutes from './routes/uploads';
import cartRoutes from './routes/cart';
import adminOrderRoutes from './routes/admin/orders';
import testEmailRoutes from './routes/test-email';
import adminCronRoutes from './routes/admin/cron';
import { prisma } from './lib/prisma'; // Use shared singleton instance
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logRateLimit, logger, loggerConfig, hashIdentifier } from './lib/logger'; // Use shared logger instance
import { cronService } from './services/cron.service';
import { startUploadValidationWorker, stopUploadValidationWorker } from './workers/upload-validator.worker';
import { startBuilderPreviewWorker, stopBuilderPreviewWorker } from './workers/builder-preview.worker';
import { builderRoutes } from './routes/builder';
import { env } from './lib/env';

const isDevelopment = process.env.NODE_ENV === 'development';

// Use shared logger configuration (Fastify will create its own Pino instance)
const app = fastify({
  logger: loggerConfig, // Pass Pino configuration object, not instance
  disableRequestLogging: false,
  requestIdLogLabel: 'requestId',
  genReqId: () => {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
});

// Register Swagger/OpenAPI documentation
app.register(swagger, {
  openapi: {
    info: {
      title: 'Korean Goods E-commerce API',
      description: 'Ð¡Ð¾Ð»Ð¾Ð½Ð³Ð¾Ñ Ñ…ÑƒÐ²Ñ†Ð°Ñ, Ð³Ð¾Ð¾ ÑÐ°Ð¹Ñ…Ð½Ñ‹ Ð±Ò¯Ñ‚ÑÑÐ³Ð´ÑÑ…Ò¯Ò¯Ð½Ð¸Ð¹ Ð¾Ð½Ð»Ð°Ð¹Ð½ Ñ…ÑƒÐ´Ð°Ð»Ð´Ð°Ð°Ð½Ñ‹ Ð¿Ð»Ð°Ñ‚Ñ„Ð¾Ñ€Ð¼Ñ‹Ð½ Backend API',
      version: '1.0.0',
      contact: {
        name: 'API Support',
        email: 'support@koreangoods.mn',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Ð¥Ó©Ð³Ð¶Ò¯Ò¯Ð»ÑÐ»Ñ‚Ð¸Ð¹Ð½ ÑÐµÑ€Ð²ÐµÑ€ (Development)',
      },
      {
        url: 'https://api.koreangoods.mn',
        description: 'ÐŸÑ€Ð¾Ð´Ð°ÐºÑˆÐ½ ÑÐµÑ€Ð²ÐµÑ€ (Production)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase JWT token (Authorization: Bearer <token>)',
        },
      },
    },
    tags: [
      { name: 'Products', description: 'Ð‘Ò¯Ñ‚ÑÑÐ³Ð´ÑÑ…Ò¯Ò¯Ð½' },
      { name: 'Categories', description: 'ÐÐ½Ð³Ð¸Ð»Ð°Ð»' },
      { name: 'Orders', description: 'Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ð°' },
      { name: 'Payment', description: 'Ð¢Ó©Ð»Ð±Ó©Ñ€' },
      { name: 'Profile', description: 'Ð¥ÑÑ€ÑÐ³Ð»ÑÐ³Ñ‡Ð¸Ð¹Ð½ Ð¼ÑÐ´ÑÑÐ»ÑÐ»' },
      { name: 'Admin', description: 'ÐÐ´Ð¼Ð¸Ð½ ÑƒÐ´Ð¸Ñ€Ð´Ð»Ð°Ð³Ð°' },
      { name: 'Health', description: 'Ð­Ñ€Ò¯Ò¯Ð» Ð¼ÑÐ½Ð´ ÑˆÐ°Ð»Ð³Ð°Ð»Ñ‚' },
    ],
  },
});

// Only expose Swagger UI in development (LOW-001 security fix)
if (isDevelopment) {
  app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
}

// 1) Plugins
const defaultAllowedOrigins = [
  'http://localhost:5173', // Store (default Vite port)
  'http://localhost:5174', // Store/Admin (next Vite port)
  'http://localhost:5175', // Store/Admin (next Vite port)
  'http://localhost:5176', // Store/Admin (next Vite port)
  'http://localhost:5184', // Store (custom local port)
  'http://localhost:5185', // Admin (custom local port)
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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // Explicitly allow all methods
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Guest-Cart-Id'], // Allow CSRF token header
  exposedHeaders: ['X-Request-Id'],
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
      message: `Too many requests. Please try again after ${context.after} seconds.`,
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

  // Correlation id for debugging across client/server logs.
  reply.header('X-Request-Id', request.id);

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
app.get('/', {
  schema: {
    description: 'API root endpoint for basic status check',
    tags: ['Health'],
    response: {
      200: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'eCommerce API is running correctly!' }
        }
      }
    }
  }
}, async () => ({ message: 'eCommerce API is running correctly!' }));

app.get('/live', {
  schema: {
    description: 'Liveness check endpoint',
    tags: ['Health'],
    response: {
      200: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
}, async () => ({
  ok: true,
  timestamp: new Date().toISOString(),
}));

app.get('/health', {
  schema: {
    description: 'Health check endpoint',
    tags: ['Health'],
    response: {
      200: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
}, async () => ({
  ok: true,
  timestamp: new Date().toISOString(),
}));
// CSRF token endpoint - Frontend can fetch this token before making state-changing requests
app.get('/csrf-token', {
  schema: {
    description: 'Get CSRF token (stored in signed cookie)',
    tags: ['Health'],
    response: {
      200: {
        type: 'object',
        properties: {
          csrfToken: { type: 'string', description: 'CSRF Ñ…Ð°Ð¼Ð³Ð°Ð°Ð»Ð°Ð»Ñ‚Ñ‹Ð½ Ñ‚Ð¾ÐºÐµÐ½' }
        }
      }
    }
  }
}, async (request, reply) => {
  const token = await reply.generateCsrf();
  return { csrfToken: token };
});

// Health check endpoint - detailed health status
app.get('/health/details', {
  preHandler: [adminGuard],
  schema: {
    description: 'Ð¡ÐµÑ€Ð²ÐµÑ€Ð¸Ð¹Ð½ ÑÑ€Ò¯Ò¯Ð» Ð¼ÑÐ½Ð´Ð¸Ð¹Ð½ Ð´ÑÐ»Ð³ÑÑ€ÑÐ½Ð³Ò¯Ð¹ ÑÑ‚Ð°Ñ‚ÑƒÑ',
    tags: ['Health'],
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['healthy'], example: 'healthy' },
          timestamp: { type: 'string', format: 'date-time' },
          database: {
            type: 'object',
            properties: {
              connected: { type: 'boolean', example: true },
              activeConnections: { type: 'number', example: 5 }
            }
          },
          uptime: { type: 'number', description: 'Ð¡ÐµÑ€Ð²ÐµÑ€Ð¸Ð¹Ð½ Ð°Ð¶Ð¸Ð»Ð»Ð°Ð¶ Ð±Ð°Ð¹Ð³Ð°Ð° Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð° (ÑÐµÐºÑƒÐ½Ð´)', example: 12345.67 },
          memory: { type: 'object', description: 'Ð¡Ð°Ð½Ð°Ñ… Ð¾Ð¹Ð½ Ð°ÑˆÐ¸Ð³Ð»Ð°Ð»Ñ‚' }
        }
      },
      503: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['unhealthy'], example: 'unhealthy' },
          timestamp: { type: 'string', format: 'date-time' },
          database: {
            type: 'object',
            properties: {
              connected: { type: 'boolean', example: false },
              error: { type: 'string', example: 'Connection refused' }
            }
          }
        }
      }
    }
  }
}, async (_request, reply) => {
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
app.get('/ready', {
  schema: {
    description: 'Ð‘ÑÐ»ÑÐ½ Ð±Ð°Ð¹Ð´Ð°Ð» ÑˆÐ°Ð»Ð³Ð°Ñ… (Kubernetes/Railway-Ð´ Ð·Ð¾Ñ€Ð¸ÑƒÐ»ÑÐ°Ð½)',
    tags: ['Health'],
    response: {
      200: {
        type: 'object',
        properties: {
          ready: { type: 'boolean', example: true }
        }
      },
      503: {
        type: 'object',
        properties: {
          ready: { type: 'boolean', example: false },
          reason: { type: 'string', example: 'database_disconnected' }
        }
      }
    }
  }
}, async (_request, reply) => {
  const { checkDatabaseHealth } = await import('./lib/prisma');

  const dbHealthy = await checkDatabaseHealth();

  if (!dbHealthy) {
    return reply.status(503).send({ ready: false, reason: 'database_disconnected' });
  }

  return { ready: true };
});

// Metrics endpoint - for monitoring systems
app.get('/metrics', {
  preHandler: [adminGuard],
  schema: {
    description: 'Ð¡ÐµÑ€Ð²ÐµÑ€Ð¸Ð¹Ð½ Ð´ÑÐ»Ð³ÑÑ€ÑÐ½Ð³Ò¯Ð¹ Ð¼ÐµÑ‚Ñ€Ð¸Ðº Ð¼ÑÐ´ÑÑÐ»ÑÐ» (Ñ…ÑÐ½Ð°Ð»Ñ‚, ÑˆÐ¸Ð½Ð¶Ð¸Ð»Ð³ÑÑÐ½Ð´)',
    tags: ['Health'],
    response: {
      200: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', format: 'date-time' },
          uptime: { type: 'number', description: 'Ð¡ÐµÑ€Ð²ÐµÑ€Ð¸Ð¹Ð½ Ð°Ð¶Ð¸Ð»Ð»Ð°Ð¶ Ð±Ð°Ð¹Ð³Ð°Ð° Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð° (ÑÐµÐºÑƒÐ½Ð´)' },
          memory: {
            type: 'object',
            properties: {
              rss: { type: 'number', description: 'RSS ÑÐ°Ð½Ð°Ñ… Ð¾Ð¹ (bytes)' },
              heapUsed: { type: 'number', description: 'Heap Ð°ÑˆÐ¸Ð³Ð»Ð°Ð¶ Ð±Ð°Ð¹Ð³Ð°Ð° (bytes)' },
              heapTotal: { type: 'number', description: 'Heap Ð½Ð¸Ð¹Ñ‚ (bytes)' },
              external: { type: 'number', description: 'External ÑÐ°Ð½Ð°Ñ… Ð¾Ð¹ (bytes)' }
            }
          },
          database: {
            type: 'object',
            properties: {
              healthy: { type: 'boolean' },
              activeConnections: { type: 'number' },
              error: { type: 'string', nullable: true }
            }
          },
          process: {
            type: 'object',
            properties: {
              pid: { type: 'number', description: 'Process ID' },
              platform: { type: 'string', example: 'linux' },
              nodeVersion: { type: 'string', example: 'v20.11.0' }
            }
          }
        }
      }
    }
  }
}, async (_request, reply) => {
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
app.get('/circuit-breakers', {
  preHandler: [adminGuard],
  schema: {
    description: 'QPay Circuit Breaker-Ð¸Ð¹Ð½ ÑÑ‚Ð°Ñ‚ÑƒÑ Ñ…ÑÐ½Ð°Ñ…',
    tags: ['Health'],
    response: {
      200: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', format: 'date-time' },
          anyCircuitOpen: { type: 'boolean', description: 'Ð¯Ð¼Ð°Ñ€ Ð½ÑÐ³ circuit Ð½ÑÑÐ»Ñ‚Ñ‚ÑÐ¹ ÑÑÑÑ…' },
          status: { type: 'string', enum: ['healthy', 'degraded'], example: 'healthy' },
          circuits: { type: 'object', description: 'Circuit-Ò¯Ò¯Ð´Ð¸Ð¹Ð½ Ð´ÑÐ»Ð³ÑÑ€ÑÐ½Ð³Ò¯Ð¹ ÑÑ‚Ð°Ñ‚ÑƒÑ' }
        }
      }
    }
  }
}, async (_request, reply) => {
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
app.register(collectionsRoutes);
app.register(publicProductRoutes, { prefix: '/api/products' });
app.register(pricingPublicRoutes);

// 5) Authenticated customer routes
app.register(orderRoutes);
app.register(profileRoutes);
app.register(paymentRoutes);
app.register(customizationRoutes);
app.register(uploadRoutes);
app.register(cartRoutes);

// 6) Admin routes
app.register(adminCategoryRoutes, { prefix: '/admin/categories' });
app.register(adminProductRoutes, { prefix: '/admin/products' });
app.register(adminCollectionsRoutes);
app.register(adminPrefillRoutes, { prefix: '/admin/prefill' });
app.register(adminStatsRoutes, { prefix: '/admin/stats' });
app.register(adminUploadRoutes, { prefix: '/admin/upload' });
app.register(adminUploadPresignedRoutes, { prefix: '/admin/upload' });
app.register(adminOrderRoutes);
app.register(adminCronRoutes);
app.register(adminProductionRoutes);
app.register(adminPricingRoutes);
app.register(adminUploadsRoutes, { prefix: '/api/admin/uploads' }); // P2-07: Upload moderation queue
app.register(adminPrintAreaRoutes, { prefix: '/api/admin/print-areas' }); // Product wizard
app.register(adminSizeTierRoutes, { prefix: '/api/admin/size-tiers' }); // Product wizard
app.register(adminLayoutTemplateRoutes, { prefix: '/api/admin/products' }); // BLANKS layout template
app.register(adminSettingsRoutes, { prefix: '/api/admin' }); // App settings (upload validation)
app.register(builderRoutes, { prefix: '/api/builder/projects' }); // P3-02: Builder API
app.register(adminReprintRoutes); // P3-05: Reprint queue
app.register(testEmailRoutes);

// 7) Error Handlers
// Set custom error handler with Sentry integration
app.setErrorHandler((error, request, reply) => {
  // Type guard: ensure error is Error instance
  const err = error instanceof Error ? error : new Error(String(error));

  // Log error locally
  request.log.error({
    error: err.message,
    stack: err.stack,
    url: request.url,
    route: request.routeOptions?.url,
    method: request.method,
    requestId: request.id,
    userIdHash: hashIdentifier(((request as any).user?.id as string | undefined)) ?? undefined,
  }, 'Request error');

  // Send to Sentry (production monitoring)
  captureException(err, {
    url: request.url,
    method: request.method,
    userIdHash: hashIdentifier(((request as any).user?.id as string | undefined)) ?? undefined,
    requestId: request.id,
  });

  // Use existing error handler for response
  return errorHandler(err, request, reply);
});

// Set custom 404 handler (handles routes that don't exist)
app.setNotFoundHandler(notFoundHandler);

// 8) Start Server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 4000;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Server is running at http://localhost:${port}`);

    // Start cron jobs for email notifications (Phase 2)
    await cronService.start();

    // Start upload validation worker (Phase 2)
    startUploadValidationWorker({
      enabled: env.WORKER_UPLOAD_VALIDATION_ENABLED,
      pollIntervalMs: env.WORKER_UPLOAD_VALIDATION_POLL_INTERVAL_MS,
      batchSize: env.WORKER_UPLOAD_VALIDATION_BATCH_SIZE,
      maxConcurrency: env.WORKER_UPLOAD_VALIDATION_MAX_CONCURRENCY,
    });

    // Start builder preview worker (Phase 3 P3-02)
    startBuilderPreviewWorker({
      enabled: env.WORKER_BUILDER_PREVIEW_ENABLED,
      pollIntervalMs: env.WORKER_BUILDER_PREVIEW_POLL_INTERVAL_MS,
      batchSize: env.WORKER_BUILDER_PREVIEW_BATCH_SIZE,
      maxConcurrency: env.WORKER_BUILDER_PREVIEW_MAX_CONCURRENCY,
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  app.log.info('SIGTERM signal received: closing HTTP server, stopping cron jobs and workers');
  cronService.stop();
  stopUploadValidationWorker();
  stopBuilderPreviewWorker();
  await app.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  app.log.info('SIGINT signal received: closing HTTP server, stopping cron jobs and workers');
  cronService.stop();
  stopUploadValidationWorker();
  stopBuilderPreviewWorker();
  await app.close();
  process.exit(0);
});

start();








