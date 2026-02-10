import { logger } from '../lib/logger';
// backend/src/routes/test-email.ts
import { FastifyInstance } from 'fastify';
import { emailService } from '../services/email.service';
import { adminGuard } from '../supabaseauth';

export default async function testEmailRoutes(fastify: FastifyInstance) {

  // Test email endpoint (admin only)
  fastify.post('/admin/test-email', {
    preHandler: [adminGuard]
  }, async (request, reply) => {
    const { to } = request.body as { to: string };

    if (!to) {
      return reply.code(400).send({ error: 'Email address required' });
    }

    try {
      logger.info('[Test Email] Sending test email to:', to);
      const result = await emailService.sendTestEmail(to);

      if (result.success) {
        return reply.send({
          success: true,
          message: 'Test email sent successfully',
          messageId: result.messageId
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      logger.error('[Test Email] Error:', error);
      return reply.code(500).send({
        error: 'Failed to send test email',
        details: error.message
      });
    }
  });

  // Test order confirmation email (admin only)
  fastify.post('/admin/test-email/order-confirmation', {
    preHandler: [adminGuard]
  }, async (request, reply) => {
    const { to } = request.body as { to: string };

    if (!to) {
      return reply.code(400).send({ error: 'Email address required' });
    }

    try {
      logger.info('[Test Email] Sending order confirmation test to:', to);

      const result = await emailService.sendOrderConfirmation(to, {
        orderId: 'test-order-123456',
        total: 125000,
        items: [
          { productName: 'Samsung Galaxy S24', variantName: '256GB Black', quantity: 1, price: 85000 },
          { productName: 'AirPods Pro', variantName: 'White', quantity: 2, price: 20000 }
        ],
        qrCodeUrl: 'https://qpay.mn/test',
        qpayInvoiceExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      });

      if (result.success) {
        return reply.send({
          success: true,
          message: 'Order confirmation test email sent',
          messageId: result.messageId
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      logger.error('[Test Email] Error:', error);
      return reply.code(500).send({
        error: 'Failed to send test email',
        details: error.message
      });
    }
  });

  // Test expiration warning email (admin only)
  fastify.post('/admin/test-email/expiration-warning', {
    preHandler: [adminGuard]
  }, async (request, reply) => {
    const { to } = request.body as { to: string };

    if (!to) {
      return reply.code(400).send({ error: 'Email address required' });
    }

    try {
      logger.info('[Test Email] Sending expiration warning test to:', to);

      const result = await emailService.sendExpirationWarning(to, {
        orderId: 'test-order-123456',
        total: 125000,
        qrCodeUrl: 'https://qpay.mn/test',
        hoursRemaining: 6
      });

      if (result.success) {
        return reply.send({
          success: true,
          message: 'Expiration warning test email sent',
          messageId: result.messageId
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: result.error
        });
      }
    } catch (error: any) {
      logger.error('[Test Email] Error:', error);
      return reply.code(500).send({
        error: 'Failed to send test email',
        details: error.message
      });
    }
  });
}
