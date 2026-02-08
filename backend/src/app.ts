import fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

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

dotenv.config();

const app = fastify({ logger: true });
const prisma = new PrismaClient();

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

// 2) Public routes
app.get('/', async () => ({ message: 'eCommerce API is running correctly! 🚀' }));

app.get('/health', async (_request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'OK', database: 'Connected' };
  } catch (error) {
    app.log.error(error);
    return reply.status(500).send({ status: 'ERROR', database: 'Disconnected' });
  }
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

// 7) Start Server
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
