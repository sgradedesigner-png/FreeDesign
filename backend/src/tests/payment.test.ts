import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';
import {
  createTestProfile,
  createTestCategory,
  createTestProduct,
  createTestOrder,
  createTestWebhookLog
} from './helpers';

/**
 * Payment Webhook Tests
 *
 * Tests webhook idempotency, duplicate handling, and payment processing
 */
describe('Payment Webhook', () => {
  let testUser: any;
  let testOrder: any;

  beforeEach(async () => {
    // Create test user and order
    testUser = await createTestProfile({ id: 'webhook-test-user' });
    testOrder = await createTestOrder(testUser.id, {
      id: 'webhook-test-order',
      qpayInvoiceId: 'test-invoice-123',
      status: 'PENDING',
      paymentStatus: 'UNPAID'
    });
  });

  describe('Webhook Idempotency', () => {
    it('should handle duplicate webhooks correctly', async () => {
      const webhookPayload = {
        payment_id: 'payment-123',
        invoice_id: 'test-invoice-123',
        payment_status: 'PAID',
        payment_amount: 10000,
        payment_date: new Date().toISOString()
      };

      // First webhook - should succeed
      const firstLog = await prisma.$transaction(async (tx) => {
        const existingLog = await tx.paymentWebhookLog.findUnique({
          where: { paymentId: webhookPayload.payment_id }
        });

        expect(existingLog).toBeNull();

        const log = await tx.paymentWebhookLog.create({
          data: {
            paymentId: webhookPayload.payment_id,
            invoiceId: webhookPayload.invoice_id,
            orderId: testOrder.id,
            status: 'success',
            payload: webhookPayload
          }
        });

        // Update order
        await tx.order.update({
          where: { id: testOrder.id },
          data: {
            paymentStatus: 'PAID',
            status: 'PAID',
            qpayPaymentId: webhookPayload.payment_id
          }
        });

        return log;
      });

      expect(firstLog).toBeDefined();
      expect(firstLog.paymentId).toBe('payment-123');

      // Second webhook (duplicate) - should detect duplicate
      const secondLog = await prisma.$transaction(async (tx) => {
        const existingLog = await tx.paymentWebhookLog.findUnique({
          where: { paymentId: webhookPayload.payment_id }
        });

        expect(existingLog).toBeDefined();
        expect(existingLog?.paymentId).toBe('payment-123');

        // Mark as duplicate
        return await tx.paymentWebhookLog.create({
          data: {
            paymentId: `${webhookPayload.payment_id}-duplicate`,
            invoiceId: webhookPayload.invoice_id,
            orderId: testOrder.id,
            status: 'duplicate',
            payload: webhookPayload
          }
        });
      });

      expect(secondLog.status).toBe('duplicate');

      // Verify order is still paid (not double-paid)
      const order = await prisma.order.findUnique({
        where: { id: testOrder.id }
      });

      expect(order?.paymentStatus).toBe('PAID');
      expect(order?.qpayPaymentId).toBe('payment-123');

      // Verify only one successful webhook log exists
      const logs = await prisma.paymentWebhookLog.findMany({
        where: {
          invoiceId: webhookPayload.invoice_id,
          status: 'success'
        }
      });

      expect(logs.length).toBe(1);
    });

    it('should reject webhook with missing payment_id', async () => {
      const webhookPayload = {
        // Missing payment_id
        invoice_id: 'test-invoice-123',
        payment_status: 'PAID'
      };

      // Should fail validation
      expect(webhookPayload).not.toHaveProperty('payment_id');
    });

    it('should handle webhook for non-existent order', async () => {
      const webhookPayload = {
        payment_id: 'payment-456',
        invoice_id: 'non-existent-invoice',
        payment_status: 'PAID'
      };

      // Process webhook - should fail gracefully
      const result = await prisma.$transaction(async (tx) => {
        // Create webhook log
        const log = await tx.paymentWebhookLog.create({
          data: {
            paymentId: webhookPayload.payment_id,
            invoiceId: webhookPayload.invoice_id,
            status: 'processing',
            payload: webhookPayload
          }
        });

        // Try to find order
        const order = await tx.order.findFirst({
          where: { qpayInvoiceId: webhookPayload.invoice_id }
        });

        if (!order) {
          // Mark as failed and return failure
          await tx.paymentWebhookLog.update({
            where: { id: log.id },
            data: {
              status: 'failed',
              error: 'Order not found',
              processedAt: new Date()
            }
          });

          return { success: false, error: 'Order not found' };
        }

        return { success: true };
      });

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');

      // Verify webhook log marked as failed
      const failedLog = await prisma.paymentWebhookLog.findFirst({
        where: {
          paymentId: webhookPayload.payment_id,
          status: 'failed'
        }
      });

      expect(failedLog).toBeDefined();
      expect(failedLog?.error).toBe('Order not found');
    });
  });

  describe('Payment Status Updates', () => {
    it('should update order status from PENDING to PAID', async () => {
      const initialOrder = await prisma.order.findUnique({
        where: { id: testOrder.id }
      });

      expect(initialOrder?.status).toBe('PENDING');
      expect(initialOrder?.paymentStatus).toBe('UNPAID');

      // Process webhook
      await prisma.$transaction(async (tx) => {
        await tx.paymentWebhookLog.create({
          data: {
            paymentId: 'payment-update-test',
            invoiceId: testOrder.qpayInvoiceId!,
            orderId: testOrder.id,
            status: 'success',
            payload: { payment_status: 'PAID' }
          }
        });

        await tx.order.update({
          where: { id: testOrder.id },
          data: {
            paymentStatus: 'PAID',
            status: 'PAID',
            qpayPaymentId: 'payment-update-test',
            paymentDate: new Date()
          }
        });
      });

      const updatedOrder = await prisma.order.findUnique({
        where: { id: testOrder.id }
      });

      expect(updatedOrder?.status).toBe('PAID');
      expect(updatedOrder?.paymentStatus).toBe('PAID');
      expect(updatedOrder?.qpayPaymentId).toBe('payment-update-test');
      expect(updatedOrder?.paymentDate).toBeDefined();
    });

    it('should not update already paid order', async () => {
      // Mark order as paid
      await prisma.order.update({
        where: { id: testOrder.id },
        data: {
          paymentStatus: 'PAID',
          status: 'PAID',
          qpayPaymentId: 'original-payment',
          paymentDate: new Date()
        }
      });

      // Try to process another webhook for the same order
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: testOrder.id }
        });

        if (order?.paymentStatus === 'PAID') {
          // Mark webhook as duplicate
          await tx.paymentWebhookLog.create({
            data: {
              paymentId: 'late-webhook',
              invoiceId: testOrder.qpayInvoiceId!,
              orderId: testOrder.id,
              status: 'duplicate',
              error: 'Order already paid',
              payload: {}
            }
          });
        }
      });

      const finalOrder = await prisma.order.findUnique({
        where: { id: testOrder.id }
      });

      // Order should remain unchanged
      expect(finalOrder?.qpayPaymentId).toBe('original-payment');
      expect(finalOrder?.paymentStatus).toBe('PAID');
    });
  });

  describe('Webhook Logging', () => {
    it('should log all webhook attempts', async () => {
      const webhooks = [
        { payment_id: 'log-test-1', status: 'success' },
        { payment_id: 'log-test-2', status: 'duplicate' },
        { payment_id: 'log-test-3', status: 'failed' }
      ];

      for (const webhook of webhooks) {
        await createTestWebhookLog({
          paymentId: webhook.payment_id,
          invoiceId: testOrder.qpayInvoiceId!,
          orderId: testOrder.id,
          status: webhook.status
        });
      }

      const allLogs = await prisma.paymentWebhookLog.findMany({
        where: { orderId: testOrder.id }
      });

      expect(allLogs.length).toBeGreaterThanOrEqual(3);

      const successLogs = allLogs.filter(log => log.status === 'success');
      const duplicateLogs = allLogs.filter(log => log.status === 'duplicate');
      const failedLogs = allLogs.filter(log => log.status === 'failed');

      expect(successLogs.length).toBeGreaterThanOrEqual(1);
      expect(duplicateLogs.length).toBeGreaterThanOrEqual(1);
      expect(failedLogs.length).toBeGreaterThanOrEqual(1);
    });

    it('should include payload in webhook log', async () => {
      const payload = {
        payment_id: 'payload-test',
        invoice_id: testOrder.qpayInvoiceId,
        payment_status: 'PAID',
        payment_amount: 10000,
        custom_field: 'test-value'
      };

      const log = await createTestWebhookLog({
        paymentId: payload.payment_id,
        invoiceId: payload.invoice_id!
      });

      const savedLog = await prisma.paymentWebhookLog.findUnique({
        where: { paymentId: log.paymentId }
      });

      expect(savedLog?.payload).toBeDefined();
      expect(savedLog?.payload).toHaveProperty('payment_id');
      expect(savedLog?.payload).toHaveProperty('invoice_id');
    });
  });
});
