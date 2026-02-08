import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { prisma } from '../lib/prisma';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Test Setup Configuration
 *
 * This file runs before all tests and sets up the testing environment.
 * It handles database connections, cleanup, and ensures tests run in isolation.
 *
 * IMPORTANT: Uses .env.test to prevent deleting production data!
 */

// Load .env.test file
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Store original environment
const originalEnv = process.env.NODE_ENV;

// Set test environment
process.env.NODE_ENV = 'test';

// Verify we're not using production database
if (process.env.DATABASE_URL?.includes('miqlyriefwqmutlsxytk')) {
  throw new Error('❌ DANGER: Tests are configured to use PRODUCTION database! Update .env.test with a separate test database.');
}

/**
 * Global setup - runs once before all tests
 */
beforeAll(async () => {
  console.log('🧪 Setting up test environment...');

  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    throw error;
  }
});

/**
 * Global teardown - runs once after all tests
 */
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');

  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected');
  } catch (error) {
    console.error('❌ Failed to disconnect from database:', error);
  }

  // Restore original environment
  process.env.NODE_ENV = originalEnv;
});

/**
 * Cleanup before each test - ensures test isolation
 *
 * WARNING: This deletes all data from test database tables!
 * Make sure you're using a separate test database.
 */
beforeEach(async () => {
  // Clean up test data in reverse order of dependencies
  await prisma.paymentWebhookLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.profile.deleteMany();
});

/**
 * Optional: Cleanup after each test
 * Uncomment if you want extra cleanup after tests
 */
// afterEach(async () => {
//   // Additional cleanup if needed
// });
