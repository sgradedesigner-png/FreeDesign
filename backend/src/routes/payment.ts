// backend/src/routes/payment.ts
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { userGuard } from '../middleware/userGuard';
import { qpayService } from '../services/qpay.service';

function getFirstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return undefined;
}

function toFiniteNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function paymentRoutes(fastify: FastifyInstance) {
  /**
   * QPay payment callback webhook
   * Accepts query/body variations to be compatible with sandbox and production callbacks.
   */
  fastify.post('/api/payment/callback', async (request, reply) => {
    try {
      const body = ((request.body ?? {}) as Record<string, unknown>);
      const query = ((request.query ?? {}) as Record<string, unknown>);

      const paymentId = getFirstString(
        body.payment_id,
        body.paymentId,
        query.payment_id,
        query.paymentId
      );
      const invoiceId = getFirstString(
        body.invoice_id,
        body.invoiceId,
        query.invoice_id,
        query.invoiceId
      );
      const orderId = getFirstString(
        body.order_id,
        body.orderId,
        body.sender_invoice_no,
        query.order_id,
        query.orderId,
        query.sender_invoice_no
      );

      if (!paymentId) {
        return reply.code(400).send({ error: 'payment_id is required' });
      }

      fastify.log.info({ paymentId, invoiceId, orderId }, 'QPay callback received');

      // Verify payment against QPay API
      const paymentData = await qpayService.getPayment(paymentId);

      const order = await prisma.order.findFirst({
        where: orderId ? { id: orderId } : { qpayInvoiceId: invoiceId }
      });

      if (!order) {
        return reply.code(404).send({ error: 'Order not found for callback' });
      }

      if (order.paymentStatus === 'PAID') {
        return reply.send({ status: 'already_processed', order_id: order.id });
      }

      const externalStatus = getFirstString(
        (paymentData as any)?.payment_status,
        (paymentData as any)?.status,
        (paymentData as any)?.rows?.[0]?.payment_status
      )?.toUpperCase();

      if (externalStatus && externalStatus !== 'PAID') {
        return reply.send({ status: 'not_paid', order_id: order.id });
      }

      // Optional but important consistency check when amount exists in response
      const paidAmount = toFiniteNumber(
        (paymentData as any)?.payment_amount ??
        (paymentData as any)?.amount ??
        (paymentData as any)?.rows?.[0]?.payment_amount
      );
      const orderAmount = Number(order.total);
      if (paidAmount !== undefined && Math.abs(paidAmount - orderAmount) > 0.01) {
        fastify.log.error(
          { paymentId, orderId: order.id, invoiceId, paidAmount, orderAmount },
          'QPay callback amount mismatch'
        );
        return reply.code(400).send({ error: 'Paid amount mismatch' });
      }

      const paymentDateRaw = getFirstString(
        (paymentData as any)?.payment_date,
        (paymentData as any)?.paid_at,
        (paymentData as any)?.rows?.[0]?.payment_date
      );
      const parsedPaymentDate = paymentDateRaw ? new Date(paymentDateRaw) : new Date();
      const paymentDate = Number.isNaN(parsedPaymentDate.getTime()) ? new Date() : parsedPaymentDate;

      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          qpayPaymentId: paymentId,
          paymentDate,
          status: 'PAID'
        }
      });

      fastify.log.info({ paymentId, orderId: order.id, invoiceId }, 'QPay payment confirmed');

      return reply.send({
        status: 'success',
        order_id: order.id,
        payment_id: paymentId
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Payment callback error');
      return reply.code(500).send({ error: 'Payment processing failed' });
    }
  });

  /**
   * Manual payment verification endpoint for frontend polling fallback.
   * Protected and user-scoped.
   */
  fastify.post(
    '/api/payment/verify',
    { preHandler: [userGuard] },
    async (request, reply) => {
      const userId = (request as any).user.id as string;
      const { orderId } = (request.body ?? {}) as { orderId?: string };

      if (!orderId) {
        return reply.code(400).send({ error: 'orderId is required' });
      }

      try {
        const order = await prisma.order.findFirst({
          where: { id: orderId, userId }
        });

        if (!order || !order.qpayInvoiceId) {
          return reply.code(404).send({ error: 'Order not found' });
        }

        const paymentCheck = await qpayService.checkPayment(order.qpayInvoiceId);

        if (paymentCheck.count > 0 && paymentCheck.rows[0].payment_status === 'PAID') {
          const payment = paymentCheck.rows[0];

          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: 'PAID',
              qpayPaymentId: payment.payment_id,
              paymentDate: new Date(payment.payment_date),
              status: 'PAID'
            }
          });

          return reply.send({
            paid: true,
            payment_id: payment.payment_id
          });
        }

        return reply.send({ paid: false });
      } catch (error) {
        fastify.log.error({ err: error, orderId, userId }, 'Payment verification error');
        return reply.code(500).send({ error: 'Failed to verify payment' });
      }
    }
  );
}

