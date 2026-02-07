// backend/src/routes/orders.ts
import { FastifyInstance } from 'fastify';
import { userGuard } from '../middleware/userGuard';
import { prisma } from '../lib/prisma';
import { qpayService } from '../services/qpay.service';

export default async function orderRoutes(fastify: FastifyInstance) {

  // Create new order with QPay invoice (authenticated customers only)
  fastify.post('/api/orders', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = (request as any).user.id;
    const { items, shippingAddress, total } = request.body as any;

    try {
      // Validate request body
      if (!items || !Array.isArray(items) || items.length === 0) {
        return reply.code(400).send({ error: 'Items are required' });
      }

      if (!total || total <= 0) {
        return reply.code(400).send({ error: 'Invalid total amount' });
      }

      // 1. Create order in database (status: PENDING, paymentStatus: UNPAID)
      const order = await prisma.order.create({
        data: {
          userId,
          total,
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          paymentMethod: 'QPAY',
          shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
          items: items, // Prisma will handle JSON serialization
        }
      });

      // 2. Create QPay invoice
      const qpayInvoice = await qpayService.createInvoice({
        orderNumber: order.id,
        amount: Number(total),
        description: `Order #${order.id.substring(0, 8)} - ${items.length} items`,
        callbackUrl: `${process.env.QPAY_CALLBACK_URL || 'http://localhost:3000/api/payment/callback'}`
      });

      // 3. Update order with QPay invoice details
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          qpayInvoiceId: qpayInvoice.invoice_id,
          qrCode: qpayInvoice.qr_image, // Base64 QR image
          qrCodeUrl: qpayInvoice.qPay_shortUrl
        }
      });

      console.log(`✅ Order created with QPay invoice: ${order.id} for user ${userId}`);

      // 4. Return order with payment info
      return reply.code(201).send({
        order: updatedOrder,
        payment: {
          qrCode: qpayInvoice.qr_image,
          qrCodeUrl: qpayInvoice.qPay_shortUrl,
          bankUrls: qpayInvoice.urls, // Deep links to banking apps
          invoiceId: qpayInvoice.invoice_id
        }
      });
    } catch (error: any) {
      console.error('Order creation error:', error);
      return reply.code(500).send({
        error: 'Failed to create order',
        details: error.message
      });
    }
  });

  // Get user's orders
  fastify.get('/api/orders', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = (request as any).user.id;

    try {
      const orders = await prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send({ orders });
    } catch (error: any) {
      console.error('Fetch orders error:', error);
      return reply.code(500).send({ error: 'Failed to fetch orders' });
    }
  });

  // Get specific order details
  fastify.get('/api/orders/:id', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as any;

    try {
      const order = await prisma.order.findFirst({
        where: {
          id,
          userId // Ensure user can only see their own orders
        }
      });

      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      return reply.send({ order });
    } catch (error: any) {
      console.error('Fetch order error:', error);
      return reply.code(500).send({ error: 'Failed to fetch order' });
    }
  });

  // Check order payment status (NEW)
  fastify.get('/api/orders/:id/payment-status', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as any;

    try {
      const order = await prisma.order.findFirst({
        where: { id, userId }
      });

      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      // If already paid, return current status
      if (order.paymentStatus === 'PAID') {
        return reply.send({
          paid: true,
          paymentDate: order.paymentDate,
          paymentId: order.qpayPaymentId
        });
      }

      // Check with QPay if payment completed
      if (order.qpayInvoiceId) {
        const paymentCheck = await qpayService.checkPayment(order.qpayInvoiceId);

        if (paymentCheck.count > 0 && paymentCheck.rows[0].payment_status === 'PAID') {
          // Payment found! Update order
          const payment = paymentCheck.rows[0];

          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: 'PAID',
              qpayPaymentId: payment.payment_id,
              paymentDate: new Date(payment.payment_date),
              status: 'PAID' // Move to PAID stage
            }
          });

          return reply.send({
            paid: true,
            paymentDate: payment.payment_date,
            paymentId: payment.payment_id
          });
        }
      }

      return reply.send({ paid: false });

    } catch (error: any) {
      console.error('Payment status check error:', error);
      return reply.code(500).send({ error: 'Failed to check payment status' });
    }
  });
}
