import { beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.test and override anything loaded earlier.
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

const originalEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'test';

// Guard against accidental production test runs.
if (process.env.DATABASE_URL?.includes('miqlyriefwqmutlsxytk')) {
  throw new Error('DANGER: Tests are configured to use production database');
}

async function safeDelete(action: () => Promise<unknown>, tableName: string) {
  try {
    await action();
  } catch (error: any) {
    const message = String(error?.message || '');
    const missingTable = error?.code === 'P2021' || message.includes('does not exist');

    if (missingTable) {
      console.warn(`Skipping cleanup for missing table: ${tableName}`);
      return;
    }

    throw error;
  }
}

beforeAll(async () => {
  console.log('Setting up test environment...');
  await prisma.$connect();
  console.log('Database connected');
});

afterAll(async () => {
  console.log('Cleaning up test environment...');
  await prisma.$disconnect();
  process.env.NODE_ENV = originalEnv;
  console.log('Database disconnected');
});

beforeEach(async () => {
  // Clean in reverse dependency order.
  await safeDelete(() => prisma.paymentWebhookLog.deleteMany(), 'payment_webhook_logs');
  await safeDelete(() => prisma.orderItemCustomization.deleteMany(), 'order_item_customizations');
  await safeDelete(() => prisma.productionStatusEvent.deleteMany(), 'production_status_events');
  await safeDelete(() => prisma.customizationAsset.deleteMany(), 'customization_assets');
  await safeDelete(() => prisma.uploadIntent.deleteMany(), 'upload_intents');
  await safeDelete(() => prisma.cartItem.deleteMany(), 'cart_items');
  await safeDelete(() => prisma.cart.deleteMany(), 'carts');
  await safeDelete(() => prisma.pricingRule.deleteMany(), 'pricing_rules');
  await safeDelete(() => prisma.productPrintArea.deleteMany(), 'product_print_areas');
  await safeDelete(() => prisma.printSizeTier.deleteMany(), 'print_size_tiers');
  await safeDelete(() => prisma.printArea.deleteMany(), 'print_areas');
  await safeDelete(() => prisma.order.deleteMany(), 'orders');
  await safeDelete(() => prisma.productVariant.deleteMany(), 'product_variants');
  await safeDelete(() => prisma.product.deleteMany(), 'products');
  await safeDelete(() => prisma.category.deleteMany(), 'categories');
  await safeDelete(() => prisma.profile.deleteMany(), 'profiles');
});
