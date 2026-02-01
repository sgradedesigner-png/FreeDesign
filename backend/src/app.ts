import fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import { adminCategoryRoutes } from './routes/admin/categories';
import { adminProductRoutes } from './routes/admin/products';
import { adminGuard } from './supabaseauth';

dotenv.config();

const app = fastify({ logger: true });
const prisma = new PrismaClient();

// 1) Plugins
app.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
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

// 4) Admin routes
app.register(adminCategoryRoutes, { prefix: '/admin/categories' });
app.register(adminProductRoutes, { prefix: '/admin/products' });

// 5) Start Server
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
