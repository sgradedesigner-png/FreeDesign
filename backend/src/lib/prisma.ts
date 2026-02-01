import { PrismaClient } from '@prisma/client';

// ✅ Shared PrismaClient instance to prevent connection pool exhaustion
// Only one instance should exist across the entire application
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
