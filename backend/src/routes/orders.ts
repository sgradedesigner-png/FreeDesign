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
    const callbackUrl = process.env.QPAY_CALLBACK_URL || '';
    const isMockMode = process.env.QPAY_MOCK_MODE === 'true';

    try {
      // Validate request body
      if (!items || !Array.isArray(items) || items.length === 0) {
        return reply.code(400).send({ error: 'Items are required' });
      }

      if (!total || total <= 0) {
        return reply.code(400).send({ error: 'Invalid total amount' });
      }

      if (!isMockMode) {
        if (!callbackUrl) {
          return reply.code(500).send({
            error: 'QPAY_CALLBACK_URL is required when QPAY_MOCK_MODE=false'
          });
        }

        if (/localhost|127\.0\.0\.1/i.test(callbackUrl)) {
          return reply.code(500).send({
            error: 'QPAY_CALLBACK_URL must be a public HTTPS URL (localhost is not allowed for QPay sandbox callback).'
          });
        }
      }

      // Cleanup old pending orders for this user before creating a new invoice
      const existingPendingOrders = await prisma.order.findMany({
        where: {
          userId,
          status: 'PENDING'
        },
        select: {
          id: true,
          qpayInvoiceId: true
        }
      });

      console.log(`[QPay Cleanup] userId=${userId} foundPending=${existingPendingOrders.length}`);
      let cancelledCount = 0;

      for (const oldOrder of existingPendingOrders) {
        if (oldOrder.qpayInvoiceId && !isMockMode) {
          try {
            await qpayService.cancelInvoiceWithTimeout(oldOrder.qpayInvoiceId, 5000);
          } catch (cancelError: any) {
            console.warn(
              `[QPay Cleanup] cancel failed orderId=${oldOrder.id} invoiceId=${oldOrder.qpayInvoiceId} reason=${cancelError?.message || 'unknown'}`
            );
          }
        }

        await prisma.order.update({
          where: { id: oldOrder.id },
          data: {
            status: 'CANCELLED',
            qpayInvoiceId: null,
            qrCode: null,
            qrCodeUrl: null
          }
        });

        cancelledCount += 1;
      }

      console.log(`[QPay Cleanup] userId=${userId} cancelled=${cancelledCount}`);

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
      console.log(`[Order Create] newOrderId=${order.id} userId=${userId}`);

      let qpayInvoice;
      try {
        // 2. Create QPay invoice
        console.log(`[QPay Invoice] start orderId=${order.id}`);
        qpayInvoice = await qpayService.createInvoice({
          orderNumber: order.id,
          amount: Number(total),
          description: `Order #${order.id.substring(0, 8)} - ${items.length} items`,
          callbackUrl
        });
        console.log(`[QPay Invoice] success orderId=${order.id} invoiceId=${qpayInvoice.invoice_id}`);
      } catch (invoiceError) {
        const errorMessage = invoiceError instanceof Error ? invoiceError.message : String(invoiceError);
        console.error(`[QPay Invoice] failed orderId=${order.id} reason=${errorMessage}`);
        // If invoice fails, remove the pending order to avoid orphan checkout records.
        await prisma.order.delete({ where: { id: order.id } }).catch(() => null);
        throw invoiceError;
      }

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
