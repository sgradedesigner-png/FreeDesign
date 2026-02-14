import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';

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
 * Create a test print area
 */
export async function createTestPrintArea(overrides?: {
  id?: string;
  name?: string;
  label?: string;
  maxWidthCm?: number;
  maxHeightCm?: number;
  sortOrder?: number;
}) {
  return await prisma.printArea.create({
    data: {
      id: overrides?.id || 'test-print-area-id',
      name: overrides?.name || 'front',
      label: overrides?.label || 'Front',
      labelEn: overrides?.label || 'Front',
      maxWidthCm: overrides?.maxWidthCm || 30,
      maxHeightCm: overrides?.maxHeightCm || 30,
      sortOrder: overrides?.sortOrder || 1,
      isActive: true,
    },
  });
}

/**
 * Create a test print size tier
 */
export async function createTestPrintSizeTier(overrides?: {
  id?: string;
  name?: string;
  label?: string;
  widthCm?: number;
  heightCm?: number;
  sortOrder?: number;
}) {
  return await prisma.printSizeTier.create({
    data: {
      id: overrides?.id || 'test-size-tier-id',
      name: overrides?.name || 'S',
      label: overrides?.label || 'Small (15x15cm)',
      widthCm: overrides?.widthCm || 15,
      heightCm: overrides?.heightCm || 15,
      sortOrder: overrides?.sortOrder || 1,
      isActive: true,
    },
  });
}

/**
 * Link product to print area
 */
export async function createTestProductPrintArea(productId: string, printAreaId: string, isDefault = false) {
  return await prisma.productPrintArea.create({
    data: {
      productId,
      printAreaId,
      isDefault,
    },
  });
}

/**
 * Create a test pricing rule
 */
export async function createTestPricingRule(overrides?: {
  id?: string;
  name?: string;
  ruleType?: 'PRINT_FEE' | 'EXTRA_SIDE' | 'QUANTITY_DISCOUNT' | 'RUSH_FEE' | 'ADD_ON';
  printSizeTierId?: string | null;
  printAreaId?: string | null;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  price?: number;
  discountPercent?: number | null;
  isActive?: boolean;
}) {
  return await prisma.pricingRule.create({
    data: {
      id: overrides?.id || 'test-pricing-rule-id',
      name: overrides?.name || 'Test pricing rule',
      ruleType: overrides?.ruleType || 'PRINT_FEE',
      printSizeTierId: overrides?.printSizeTierId ?? null,
      printAreaId: overrides?.printAreaId ?? null,
      minQuantity: overrides?.minQuantity ?? null,
      maxQuantity: overrides?.maxQuantity ?? null,
      price: overrides?.price ?? 1000,
      discountPercent: overrides?.discountPercent ?? null,
      isActive: overrides?.isActive ?? true,
    },
  });
}

/**
 * Create test customization asset
 */
export async function createTestCustomizationAsset(userId: string, overrides?: {
  id?: string;
  originalUrl?: string;
  thumbnailUrl?: string | null;
  cloudinaryId?: string | null;
  fileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  widthPx?: number | null;
  heightPx?: number | null;
  isValid?: boolean;
}) {
  return await prisma.customizationAsset.create({
    data: {
      id: overrides?.id || 'test-custom-asset-id',
      userId,
      originalUrl: overrides?.originalUrl || 'https://res.cloudinary.com/test/image/upload/v1/designs/test.png',
      thumbnailUrl: overrides?.thumbnailUrl ?? 'https://res.cloudinary.com/test/image/upload/w_200,c_limit/v1/designs/test.png',
      cloudinaryId: overrides?.cloudinaryId ?? 'designs/test',
      fileName: overrides?.fileName || 'test.png',
      mimeType: overrides?.mimeType || 'image/png',
      fileSizeBytes: overrides?.fileSizeBytes || 1024,
      widthPx: overrides?.widthPx ?? 1200,
      heightPx: overrides?.heightPx ?? 1200,
      dpi: null,
      isValid: overrides?.isValid ?? true,
    },
  });
}

/**
 * Create test order item customization
 */
export async function createTestOrderItemCustomization(overrides: {
  orderId: string;
  orderItemIndex: number;
  printAreaId: string;
  printSizeTierId: string;
  assetId: string;
  printFee?: number;
  placementConfig?: Prisma.InputJsonValue;
}) {
  return await prisma.orderItemCustomization.create({
    data: {
      orderId: overrides.orderId,
      orderItemIndex: overrides.orderItemIndex,
      printAreaId: overrides.printAreaId,
      printSizeTierId: overrides.printSizeTierId,
      assetId: overrides.assetId,
      printFee: overrides.printFee ?? 1000,
      placementConfig: overrides.placementConfig,
    },
  });
}

/**
 * Create test production status event
 */
export async function createTestProductionStatusEvent(overrides: {
  orderId: string;
  fromStatus?: 'NEW' | 'ART_CHECK' | 'READY_TO_PRINT' | 'PRINTING' | 'QC' | 'PACKED' | 'SHIPPED' | 'DONE' | null;
  toStatus: 'NEW' | 'ART_CHECK' | 'READY_TO_PRINT' | 'PRINTING' | 'QC' | 'PACKED' | 'SHIPPED' | 'DONE';
  changedBy?: string;
  notes?: string | null;
}) {
  return await prisma.productionStatusEvent.create({
    data: {
      orderId: overrides.orderId,
      fromStatus: overrides.fromStatus ?? null,
      toStatus: overrides.toStatus,
      changedBy: overrides.changedBy || 'test-admin',
      notes: overrides.notes ?? null,
    },
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
  // Ensure FK target exists even if cleanup hooks race with test-local profile creation.
  const emailLocalPart = userId.replace(/[^a-zA-Z0-9._-]/g, '-');
  await prisma.profile.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: `${emailLocalPart}@test.local`,
      name: 'Test User',
      phone: '99999999',
      role: 'CUSTOMER',
    },
  });

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
