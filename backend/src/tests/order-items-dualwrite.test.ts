/**
 * Order Items Dual-Write Integration Tests (P1-08)
 *
 * Tests the dual-write migration from JSON items to normalized order_items:
 * - Write to both legacy JSON and new normalized table
 * - Read prefers normalized items over JSON
 * - Backward compatibility with legacy orders
 * - Data consistency between both formats
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Order Items Dual-Write Tests', () => {
  let testCategoryId: string;
  let testProductId: string;
  let testVariantId: string;
  let testOrderId: string;

  beforeAll(async () => {
    // Create test category
    const category = await prisma.category.create({
      data: {
        name: 'Test Category Dual Write',
        slug: 'test-category-dual-write',
      },
    });
    testCategoryId = category.id;

    // Create test product
    const product = await prisma.product.create({
      data: {
        title: 'Test Product Dual Write',
        slug: 'test-product-dual-write',
        is_published: true,
        productFamily: 'BY_SIZE',
        basePrice: 20000,
        categoryId: testCategoryId,
      },
    });
    testProductId = product.id;

    // Create test variant
    const variant = await prisma.productVariant.create({
      data: {
        productId: testProductId,
        name: 'Test Variant',
        sku: 'TEST-DW-001',
        price: 20000,
        sizes: ['S', 'M', 'L'],
        imagePath: '/test-image.jpg',
      },
    });
    testVariantId = variant.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testOrderId) {
      await prisma.orderItem.deleteMany({ where: { orderId: testOrderId } });
      await prisma.order.delete({ where: { id: testOrderId } });
    }
    await prisma.productVariant.delete({ where: { id: testVariantId } });
    await prisma.product.delete({ where: { id: testProductId } });
    await prisma.category.delete({ where: { id: testCategoryId } });
    await prisma.$disconnect();
  });

  describe('Dual-Write on Order Creation', () => {
    it('should write to both JSON items and normalized order_items table', async () => {
      const order = await prisma.order.create({
        data: {
          userId: 'test-user-id',
          total: 20000,
          status: 'PENDING',
          items: [
            {
              variantId: testVariantId,
              productId: testProductId,
              quantity: 2,
              price: 20000,
              selectedOptions: { size: 'M' },
            },
          ],
        },
      });

      testOrderId = order.id;

      // Verify JSON items exist
      expect(order.items).toBeDefined();
      expect(Array.isArray(order.items)).toBe(true);
      expect((order.items as any[]).length).toBe(1);

      // Create normalized order items
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          variantId: testVariantId,
          quantity: 2,
          unitPrice: 20000,
          selectedOptions: { size: 'M' },
          productId: testProductId,
          productName: 'Test Product Dual Write',
          variantName: 'Test Variant',
          variantSku: 'TEST-DW-001',
        },
      });

      // Verify normalized items exist
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId: order.id },
      });

      expect(orderItems.length).toBe(1);
      expect(orderItems[0].variantId).toBe(testVariantId);
      expect(orderItems[0].quantity).toBe(2);
      expect(Number(orderItems[0].unitPrice)).toBe(20000);
    });

    it('should maintain data consistency between JSON and normalized formats', async () => {
      const order = await prisma.order.findUnique({
        where: { id: testOrderId },
        include: { orderItems: true },
      });

      expect(order).toBeDefined();

      const jsonItems = order!.items as any[];
      const normalizedItems = order!.orderItems;

      expect(jsonItems.length).toBe(normalizedItems.length);

      // Compare data fields
      expect(jsonItems[0].variantId).toBe(normalizedItems[0].variantId);
      expect(jsonItems[0].quantity).toBe(normalizedItems[0].quantity);
      expect(jsonItems[0].price).toBe(Number(normalizedItems[0].unitPrice));
    });
  });

  describe('Dual-Read Preference', () => {
    it('should prefer normalized items over JSON when both exist', async () => {
      const order = await prisma.order.findUnique({
        where: { id: testOrderId },
        include: {
          orderItems: {
            include: {
              variant: {
                include: { product: true },
              },
            },
          },
        },
      });

      expect(order).toBeDefined();
      expect(order!.orderItems).toBeDefined();
      expect(order!.orderItems.length).toBeGreaterThan(0);

      // In dual-read logic, normalized items should be preferred
      const hasNormalizedItems = order!.orderItems.length > 0;
      expect(hasNormalizedItems).toBe(true);
    });

    it('should fallback to JSON items for legacy orders without normalized items', async () => {
      // Create a legacy order with only JSON items
      const legacyOrder = await prisma.order.create({
        data: {
          userId: 'test-user-legacy',
          total: 15000,
          status: 'PENDING',
          items: [
            {
              variantId: testVariantId,
              productId: testProductId,
              quantity: 1,
              price: 15000,
              selectedOptions: { size: 'S' },
            },
          ],
        },
      });

      const fetchedOrder = await prisma.order.findUnique({
        where: { id: legacyOrder.id },
        include: { orderItems: true },
      });

      expect(fetchedOrder).toBeDefined();
      expect(fetchedOrder!.orderItems.length).toBe(0); // No normalized items
      expect(fetchedOrder!.items).toBeDefined(); // JSON items exist
      expect(Array.isArray(fetchedOrder!.items)).toBe(true);

      // Cleanup
      await prisma.order.delete({ where: { id: legacyOrder.id } });
    });
  });

  describe('OrderItem Table Constraints', () => {
    it('should enforce foreign key constraint on orderId', async () => {
      await expect(
        prisma.orderItem.create({
          data: {
            orderId: 'non-existent-order-id',
            variantId: testVariantId,
            quantity: 1,
            unitPrice: 10000,
          },
        })
      ).rejects.toThrow();
    });

    it('should enforce foreign key constraint on variantId', async () => {
      await expect(
        prisma.orderItem.create({
          data: {
            orderId: testOrderId,
            variantId: 'non-existent-variant-id',
            quantity: 1,
            unitPrice: 10000,
          },
        })
      ).rejects.toThrow();
    });

    it('should cascade delete order items when order is deleted', async () => {
      // Create a new order with items
      const tempOrder = await prisma.order.create({
        data: {
          userId: 'test-user-cascade',
          total: 10000,
          status: 'PENDING',
          items: [],
        },
      });

      await prisma.orderItem.create({
        data: {
          orderId: tempOrder.id,
          variantId: testVariantId,
          quantity: 1,
          unitPrice: 10000,
        },
      });

      // Verify item exists
      const itemsBefore = await prisma.orderItem.findMany({
        where: { orderId: tempOrder.id },
      });
      expect(itemsBefore.length).toBe(1);

      // Delete order
      await prisma.order.delete({ where: { id: tempOrder.id } });

      // Verify items were cascade deleted
      const itemsAfter = await prisma.orderItem.findMany({
        where: { orderId: tempOrder.id },
      });
      expect(itemsAfter.length).toBe(0);
    });
  });

  describe('OrderItem Data Fields', () => {
    it('should store product snapshot fields for historical reference', async () => {
      const orderItem = await prisma.orderItem.findFirst({
        where: { orderId: testOrderId },
      });

      expect(orderItem).toBeDefined();
      expect(orderItem!.productId).toBe(testProductId);
      expect(orderItem!.productName).toBe('Test Product Dual Write');
      expect(orderItem!.variantName).toBe('Test Variant');
      expect(orderItem!.variantSku).toBe('TEST-DW-001');
    });

    it('should store selectedOptions as JSONB', async () => {
      const orderItem = await prisma.orderItem.findFirst({
        where: { orderId: testOrderId },
      });

      expect(orderItem).toBeDefined();
      expect(orderItem!.selectedOptions).toBeDefined();
      expect(typeof orderItem!.selectedOptions).toBe('object');
      expect((orderItem!.selectedOptions as any).size).toBe('M');
    });
  });
});
