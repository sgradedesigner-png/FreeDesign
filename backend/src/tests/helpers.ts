import { prisma } from '../lib/prisma';

/**
 * Test Helper Functions
 *
 * Utility functions to create test data and mock dependencies
 */

/**
 * Create a test user/profile
 */
export async function createTestProfile(overrides?: {
  id?: string;
  email?: string;
  name?: string;
  phone?: string;
  role?: 'CUSTOMER' | 'ADMIN' | 'EDITOR';
}) {
  return await prisma.profile.create({
    data: {
      id: overrides?.id || 'test-user-id',
      email: overrides?.email || 'test@example.com',
      name: overrides?.name || 'Test User',
      phone: overrides?.phone || '99999999',
      role: overrides?.role || 'CUSTOMER'
    }
  });
}

/**
 * Create a test category
 */
export async function createTestCategory(overrides?: {
  id?: string;
  name?: string;
  slug?: string;
}) {
  return await prisma.category.create({
    data: {
      id: overrides?.id || 'test-category-id',
      name: overrides?.name || 'Test Category',
      slug: overrides?.slug || 'test-category'
    }
  });
}

/**
 * Create a test product
 */
export async function createTestProduct(categoryId: string, overrides?: {
  id?: string;
  title?: string;
  basePrice?: number;
}) {
  return await prisma.product.create({
    data: {
      id: overrides?.id || 'test-product-id',
      title: overrides?.title || 'Test Product',
      slug: 'test-product',
      description: 'Test product description',
      basePrice: overrides?.basePrice || 10000,
      categoryId: categoryId
    }
  });
}

/**
 * Create a test product variant
 */
export async function createTestProductVariant(productId: string, overrides?: {
  id?: string;
  name?: string;
  price?: number;
  stock?: number;
  sku?: string;
}) {
  return await prisma.productVariant.create({
    data: {
      id: overrides?.id || 'test-variant-id',
      productId: productId,
      name: overrides?.name || 'Test Variant',
      sku: overrides?.sku || 'TEST-SKU-001',
      price: overrides?.price || 10000,
      stock: overrides?.stock || 50,
      imagePath: 'https://example.com/variant.jpg'
    }
  });
}

/**
 * Create a test order
 */
export async function createTestOrder(userId: string, overrides?: {
  id?: string;
  total?: number;
  status?: 'PENDING' | 'PAID' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED' | 'CANCELLING' | 'CANCELLATION_FAILED';
  paymentStatus?: string;
  qpayInvoiceId?: string;
}) {
  return await prisma.order.create({
    data: {
      id: overrides?.id || 'test-order-id',
      userId: userId,
      total: overrides?.total || 10000,
      status: overrides?.status || 'PENDING',
      paymentStatus: overrides?.paymentStatus || 'UNPAID',
      paymentMethod: 'QPAY',
      qpayInvoiceId: overrides?.qpayInvoiceId,
      items: [
        {
          id: 'item-1',
          quantity: 1,
          price: 10000,
          productName: 'Test Product',
          variantName: 'Test Variant'
        }
      ],
      shippingAddress: JSON.stringify({
        fullName: 'Test User',
        phone: '99999999',
        address: 'Test Address',
        city: 'Ulaanbaatar',
        zipCode: '14200'
      })
    }
  });
}

/**
 * Create a test webhook log
 */
export async function createTestWebhookLog(overrides?: {
  paymentId?: string;
  invoiceId?: string;
  orderId?: string;
  status?: string;
}) {
  return await prisma.paymentWebhookLog.create({
    data: {
      paymentId: overrides?.paymentId || 'test-payment-id',
      invoiceId: overrides?.invoiceId || 'test-invoice-id',
      orderId: overrides?.orderId,
      status: overrides?.status || 'success',
      payload: {
        payment_id: overrides?.paymentId || 'test-payment-id',
        invoice_id: overrides?.invoiceId || 'test-invoice-id',
        payment_status: 'PAID'
      }
    }
  });
}

/**
 * Mock JWT token for testing authenticated routes
 */
export function createMockAuthToken(userId: string = 'test-user-id'): string {
  // In real tests, you'd generate a proper JWT
  // For now, return a mock token that userGuard can recognize
  return `Bearer mock-token-${userId}`;
}

/**
 * Wait for a specific amount of time (for async operations)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
