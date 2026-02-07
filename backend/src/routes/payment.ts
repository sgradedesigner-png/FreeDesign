// backend/src/routes/payment.ts
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { qpayService } from '../services/qpay.service';

export default async function paymentRoutes(fastify: FastifyInstance) {

  /**
   * QPay Payment Callback Webhook
   * QPay calls this when customer completes payment
   *
   * Expected query params or body:
   * - payment_id: QPay payment ID
   * - invoice_id: QPay invoice ID (optional)
   * - order_id: Our order ID (from sender_invoice_no)
   */
  fastify.post('/api/payment/callback', async (request, reply) => {
    try {
      const { payment_id, invoice_id, order_id } = request.body as any;

      console.log('📥 QPay callback received:', { payment_id, invoice_id, order_id });

      // Verify payment with QPay
      let paymentData;
      try {
        paymentData = await qpayService.getPayment(payment_id);
      } catch (error) {
        console.error('Failed to verify payment with QPay:', error);
        return reply.code(400).send({ error: 'Invalid payment ID' });
      }

      // Find order by invoice ID or order ID
      const order = await prisma.order.findFirst({
        where: order_id ? { id: order_id } : { qpayInvoiceId: invoice_id }
      });

      if (!order) {
        console.error('Order not found for payment:', { payment_id, order_id, invoice_id });
        return reply.code(404).send({ error: 'Order not found' });
      }

      // Check if already processed
      if (order.paymentStatus === 'PAID') {
        console.log('⚠️ Payment already processed for order:', order.id);
        return reply.send({ status: 'already_processed' });
      }

      // Update order with payment info
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          qpayPaymentId: payment_id,
          paymentDate: new Date(),
          status: 'PAID' // Start processing the order
        }
      });

      console.log('✅ Payment confirmed for order:', order.id);

      // TODO: Send confirmation email to customer
      // TODO: Notify admin about new paid order

      return reply.send({
        status: 'success',
        order_id: order.id,
        payment_id: payment_id
      });

    } catch (error: any) {
      console.error('❌ Payment callback error:', error);
      return reply.code(500).send({ error: 'Payment processing failed' });
    }
  });

  /**
   * Manual payment verification endpoint
   * For polling from frontend if callback fails
   */
  fastify.post('/api/payment/verify', async (request, reply) => {
    const { orderId } = request.body as any;

    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId }
      });

      if (!order || !order.qpayInvoiceId) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      // Check payment status with QPay
      const paymentCheck = await qpayService.checkPayment(order.qpayInvoiceId);

      if (paymentCheck.count > 0 && paymentCheck.rows[0].payment_status === 'PAID') {
        const payment = paymentCheck.rows[0];

        // Update order
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

    } catch (error: any) {
      console.error('Payment verification error:', error);
      return reply.code(500).send({ error: 'Failed to verify payment' });
    }
  });
}
