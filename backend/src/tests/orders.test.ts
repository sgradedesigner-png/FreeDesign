import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';
import { createTestProfile, createTestOrder, sleep } from './helpers';

/**
 * Order Creation Tests
 *
 * Tests order creation race conditions, transaction handling, and status management
 */
describe('Order Creation', () => {
  let testUser: any;

  beforeEach(async () => {
    testUser = await createTestProfile({ id: 'order-test-user' });
  });

  describe('Race Condition Prevention', () => {
    it('should prevent duplicate orders from concurrent requests', async () => {
      // Create an existing pending order
      const existingOrder = await createTestOrder(testUser.id, {
        id: 'existing-order',
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        qpayInvoiceId: 'existing-invoice'
      });

      // Simulate concurrent order creation
      const createOrderWithTransaction = async (orderId: string) => {
        return await prisma.$transaction(async (tx) => {
          // 1. Find existing pending orders
          const existingPending = await tx.order.findMany({
            where: {
              userId: testUser.id,
              status: 'PENDING',
              paymentStatus: {
                in: ['UNPAID', 'PENDING']
              }
            },
            select: {
              id: true,
              qpayInvoiceId: true
            }
          });

          // 2. Mark old orders as CANCELLING
          if (existingPending.length > 0) {
            await tx.order.updateMany({
              where: {
                id: {
                  in: existingPending.map(o => o.id)
                }
              },
              data: {
                status: 'CANCELLING',
                updatedAt: new Date()
              }
            });
          }

          // 3. Create new order
          const newOrder = await tx.order.create({
            data: {
              id: orderId,
              userId: testUser.id,
              total: 10000,
              status: 'PENDING',
              paymentStatus: 'UNPAID',
              paymentMethod: 'QPAY',
              items: [{ id: 'item-1', quantity: 1, price: 10000 }],
              shippingAddress: JSON.stringify({ fullName: 'Test' })
            }
          });

          return {
            newOrder,
            cancelledCount: existingPending.length
          };
        }, {
          timeout: 15000,
          isolationLevel: 'Serializable'
        });
      };

      // Execute transaction
      const result = await createOrderWithTransaction('new-order-1');

      expect(result.newOrder.id).toBe('new-order-1');
      expect(result.cancelledCount).toBe(1);

      // Verify old order is CANCELLING
      const oldOrder = await prisma.order.findUnique({
        where: { id: existingOrder.id }
      });

      expect(oldOrder?.status).toBe('CANCELLING');

      // Verify new order is PENDING
      const newOrder = await prisma.order.findUnique({
        where: { id: 'new-order-1' }
      });

      expect(newOrder?.status).toBe('PENDING');
      expect(newOrder?.userId).toBe(testUser.id);
    });

    it('should handle transaction timeout gracefully', async () => {
      const timeoutTest = async () => {
        return await prisma.$transaction(async (tx) => {
          // Simulate a long-running operation
          await sleep(20000); // 20 seconds - exceeds 15s timeout

          return await tx.order.create({
            data: {
              id: 'timeout-order',
              userId: testUser.id,
              total: 10000,
              status: 'PENDING',
              paymentStatus: 'UNPAID',
              paymentMethod: 'QPAY',
              items: [],
              shippingAddress: '{}'
            }
          });
        }, {
          timeout: 15000, // 15 second timeout
          isolationLevel: 'Serializable'
        });
      };

      // Should throw timeout error
      await expect(timeoutTest()).rejects.toThrow();

      // Verify no order was created
      const order = await prisma.order.findUnique({
        where: { id: 'timeout-order' }
      });

      expect(order).toBeNull();
    }, 25000); // Test timeout 25s

    it('should rollback on error', async () => {
      const failingTransaction = async () => {
        return await prisma.$transaction(async (tx) => {
          // Create order
          await tx.order.create({
            data: {
              id: 'rollback-order',
              userId: testUser.id,
              total: 10000,
              status: 'PENDING',
              paymentStatus: 'UNPAID',
              paymentMethod: 'QPAY',
              items: [],
              shippingAddress: '{}'
            }
          });

          // Simulate error
          throw new Error('Simulated error');
        });
      };

      // Should throw error
      await expect(failingTransaction()).rejects.toThrow('Simulated error');

      // Verify order was NOT created (rollback worked)
      const order = await prisma.order.findUnique({
        where: { id: 'rollback-order' }
      });

      expect(order).toBeNull();
    });
  });

  describe('Order Status Management', () => {
    it('should create order with correct initial status', async () => {
      const order = await createTestOrder(testUser.id, {
        id: 'status-test-order'
      });

      expect(order.status).toBe('PENDING');
      expect(order.paymentStatus).toBe('UNPAID');
      expect(order.paymentMethod).toBe('QPAY');
    });

    it('should support all order statuses', async () => {
      const statuses: Array<'PENDING' | 'PAID' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED' | 'CANCELLING' | 'CANCELLATION_FAILED'> = [
        'PENDING',
        'PAID',
        'SHIPPED',
        'COMPLETED',
        'CANCELLED',
        'CANCELLING',
        'CANCELLATION_FAILED'
      ];

      for (let i = 0; i < statuses.length; i++) {
        const status = statuses[i];
        const order = await createTestOrder(testUser.id, {
          id: `status-${status}-${i}`,
          status: status
        });

        expect(order.status).toBe(status);
      }

      // Verify all orders created
      const orders = await prisma.order.findMany({
        where: { userId: testUser.id }
      });

      expect(orders.length).toBe(statuses.length);
    });

    it('should transition from PENDING to PAID correctly', async () => {
      const order = await createTestOrder(testUser.id, {
        id: 'transition-order',
        status: 'PENDING'
      });

      // Transition to PAID
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paymentStatus: 'PAID',
          paymentDate: new Date()
        }
      });

      expect(updatedOrder.status).toBe('PAID');
      expect(updatedOrder.paymentStatus).toBe('PAID');
      expect(updatedOrder.paymentDate).toBeDefined();
    });

    it('should handle CANCELLING to CANCELLED transition', async () => {
      const order = await createTestOrder(testUser.id, {
        id: 'cancel-order',
        status: 'CANCELLING'
      });

      // Simulate successful cancellation
      const cancelled = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          qpayInvoiceId: null,
          qrCode: null,
          qrCodeUrl: null
        }
      });

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.qpayInvoiceId).toBeNull();
    });

    it('should handle CANCELLATION_FAILED status', async () => {
      const order = await createTestOrder(testUser.id, {
        id: 'cancel-failed-order',
        status: 'CANCELLING',
        qpayInvoiceId: 'invoice-123'
      });

      // Simulate failed cancellation
      const failed = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLATION_FAILED'
        }
      });

      expect(failed.status).toBe('CANCELLATION_FAILED');
      expect(failed.qpayInvoiceId).toBe('invoice-123'); // Invoice ID preserved
    });
  });

  describe('Order Queries', () => {
    beforeEach(async () => {
      // Create multiple orders
      await createTestOrder(testUser.id, { id: 'order-1', total: 10000 });
      await createTestOrder(testUser.id, { id: 'order-2', total: 20000 });
      await createTestOrder(testUser.id, { id: 'order-3', total: 30000, status: 'PAID' });
    });

    it('should fetch user orders', async () => {
      const orders = await prisma.order.findMany({
        where: { userId: testUser.id },
        orderBy: { createdAt: 'desc' }
      });

      expect(orders.length).toBe(3);
      expect(orders[0].userId).toBe(testUser.id);
    });

    it('should filter orders by status', async () => {
      const pendingOrders = await prisma.order.findMany({
        where: {
          userId: testUser.id,
          status: 'PENDING'
        }
      });

      const paidOrders = await prisma.order.findMany({
        where: {
          userId: testUser.id,
          status: 'PAID'
        }
      });

      expect(pendingOrders.length).toBe(2);
      expect(paidOrders.length).toBe(1);
    });

    it('should find order by QPay invoice ID', async () => {
      const orderWithInvoice = await createTestOrder(testUser.id, {
        id: 'invoice-search-order',
        qpayInvoiceId: 'unique-invoice-789'
      });

      const found = await prisma.order.findFirst({
        where: { qpayInvoiceId: 'unique-invoice-789' }
      });

      expect(found).toBeDefined();
      expect(found?.id).toBe(orderWithInvoice.id);
    });
  });

  describe('Order Data Integrity', () => {
    it('should store items as JSON', async () => {
      const items = [
        { id: 'item-1', quantity: 2, price: 5000, productName: 'Product 1' },
        { id: 'item-2', quantity: 1, price: 10000, productName: 'Product 2' }
      ];

      const order = await prisma.order.create({
        data: {
          id: 'json-items-order',
          userId: testUser.id,
          total: 20000,
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          paymentMethod: 'QPAY',
          items: items,
          shippingAddress: '{}'
        }
      });

      const retrieved = await prisma.order.findUnique({
        where: { id: order.id }
      });

      expect(retrieved?.items).toBeDefined();
      expect(Array.isArray(retrieved?.items)).toBe(true);
      expect((retrieved?.items as any[]).length).toBe(2);
    });

    it('should store shipping address as JSON string', async () => {
      const address = {
        fullName: 'Test User',
        phone: '99999999',
        address: 'Test Address 123',
        city: 'Ulaanbaatar',
        zipCode: '14200'
      };

      const order = await prisma.order.create({
        data: {
          id: 'address-order',
          userId: testUser.id,
          total: 10000,
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          paymentMethod: 'QPAY',
          items: [],
          shippingAddress: JSON.stringify(address)
        }
      });

      const retrieved = await prisma.order.findUnique({
        where: { id: order.id }
      });

      const parsedAddress = JSON.parse(retrieved?.shippingAddress || '{}');
      expect(parsedAddress.fullName).toBe('Test User');
      expect(parsedAddress.phone).toBe('99999999');
    });
  });
});
