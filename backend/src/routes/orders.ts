// backend/src/routes/orders.ts
import { FastifyInstance } from 'fastify';
import { userGuard } from '../middleware/userGuard';
import { prisma } from '../lib/prisma';
import { qpayService } from '../services/qpay.service';
import { qpayCircuitBreaker } from '../services/qpay-circuit-breaker.service';
import { createOrderSchema } from '../schemas/order.schema';
import { orderIdParamSchema } from '../schemas/payment.schema';
import { validateData } from '../utils/validation';
import { NotFoundError, ServiceUnavailableError, BadRequestError, PaymentServiceError } from '../utils/errors';

export default async function orderRoutes(fastify: FastifyInstance) {

  // Create new order with QPay invoice (authenticated customers only)
  fastify.post('/api/orders', {
    preHandler: [userGuard],
    config: {
      rateLimit: {
        max: 5, // 5 orders per minute max
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const userId = (request as any).user.id;
    const callbackUrl = process.env.QPAY_CALLBACK_URL || '';
    const isMockMode = process.env.QPAY_MOCK_MODE === 'true';

    try {
      // Log request body for debugging
      console.log('[Order Creation] Request body:', JSON.stringify(request.body, null, 2));

      // Validate request body with Zod
      const validation = validateData(createOrderSchema, request.body, reply);
      if (!validation.success) {
        console.log('[Order Creation] Validation failed:', JSON.stringify(validation.error, null, 2));
        return; // Error response already sent by validateData
      }

      console.log('[Order Creation] Validation passed');

      const { items: rawItems, shippingAddress, total } = validation.data;

      // Normalize items to ensure price field exists
      const items = rawItems.map(item => ({
        ...item,
        price: item.price || item.variantPrice || 0
      }));

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

      // Use transaction to prevent race condition when user double-clicks checkout
      const { order, oldPendingOrders } = await prisma.$transaction(async (tx) => {
        // 1. Find existing pending orders INSIDE transaction
        const existingPending = await tx.order.findMany({
          where: {
            userId,
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

        console.log(`[QPay Cleanup] userId=${userId} foundPending=${existingPending.length}`);

        // 2. Mark old orders as CANCELLING to prevent race condition
        // This blocks other concurrent requests from seeing these orders as PENDING
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

          console.log(`[QPay Cleanup] userId=${userId} marked ${existingPending.length} as CANCELLING`);
        }

        // 3. Create new order INSIDE transaction (prevents duplicate creation)
        const newOrder = await tx.order.create({
          data: {
            userId,
            total,
            status: 'PENDING',
            paymentStatus: 'UNPAID',
            paymentMethod: 'QPAY',
            shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
            items: items,
          }
        });

        console.log(`[Order Create] newOrderId=${newOrder.id} userId=${userId}`);

        return {
          order: newOrder,
          oldPendingOrders: existingPending
        };
      }, {
        timeout: 15000, // 15 second timeout for transaction
        isolationLevel: 'Serializable' // Highest isolation level to prevent race conditions
      });

      // 4. Cancel old QPay invoices in BACKGROUND (outside transaction)
      // This prevents transaction from blocking on slow QPay API calls
      if (oldPendingOrders.length > 0) {
        setImmediate(() => {
          oldPendingOrders.forEach(oldOrder => {
            if (oldOrder.qpayInvoiceId && !isMockMode) {
              qpayService.cancelInvoiceWithTimeout(oldOrder.qpayInvoiceId, 5000)
                .then(() => {
                  console.log(`[QPay Cleanup] Cancelled invoice ${oldOrder.qpayInvoiceId}`);
                  // Mark as CANCELLED after successful cancellation
                  prisma.order.update({
                    where: { id: oldOrder.id },
                    data: {
                      status: 'CANCELLED',
                      qpayInvoiceId: null,
                      qrCode: null,
                      qrCodeUrl: null
                    }
                  }).catch(err => console.error('Failed to update cancelled order:', err));
                })
                .catch(err => {
                  console.warn(`[QPay Cleanup] Failed to cancel invoice ${oldOrder.qpayInvoiceId}:`, err.message);
                  // Mark as CANCELLATION_FAILED if QPay cancellation failed
                  prisma.order.update({
                    where: { id: oldOrder.id },
                    data: { status: 'CANCELLATION_FAILED' }
                  }).catch(e => console.error('Failed to mark cancellation failed:', e));
                });
            } else {
              // No invoice to cancel, just mark as CANCELLED
              prisma.order.update({
                where: { id: oldOrder.id },
                data: {
                  status: 'CANCELLED',
                  qpayInvoiceId: null,
                  qrCode: null,
                  qrCodeUrl: null
                }
              }).catch(err => console.error('Failed to update cancelled order:', err));
            }
          });
        });
      }

      // 5. Create QPay invoice with Circuit Breaker (OUTSIDE transaction to avoid blocking)
      let qpayInvoice;
      try {
        console.log(`[QPay Invoice] start orderId=${order.id}`);
        qpayInvoice = await qpayCircuitBreaker.createInvoice({
          orderNumber: order.id,
          amount: Number(total),
          description: `Order #${order.id.substring(0, 8)} - ${items.length} items`,
          callbackUrl
        });
        console.log(`[QPay Invoice] success orderId=${order.id} invoiceId=${qpayInvoice.invoice_id}`);
      } catch (invoiceError: any) {
        const errorMessage = invoiceError instanceof Error ? invoiceError.message : String(invoiceError);
        console.error(`[QPay Invoice] failed orderId=${order.id} reason=${errorMessage}`);

        // Mark order as PENDING for circuit open or service unavailable
        const isCircuitOpen = invoiceError.code === 'CIRCUIT_OPEN';
        const isTimeout = invoiceError.code === 'TIMEOUT';

        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: isCircuitOpen || isTimeout ? 'PENDING' : 'CANCELLED',
            paymentStatus: isCircuitOpen || isTimeout ? 'PENDING' : 'FAILED'
          }
        }).catch(() => null);

        // For circuit open, throw PaymentServiceError
        if (isCircuitOpen) {
          throw new PaymentServiceError('Төлбөрийн систем түр ашиглах боломжгүй байна. Та дараа дахин оролдоно уу.');
        }

        // For timeout, throw ServiceUnavailableError
        if (isTimeout) {
          throw new ServiceUnavailableError('Төлбөрийн систем хариу өгөх хугацаа хэтэрсэн. Та дараа дахин оролдоно уу.');
        }

        // Other errors
        throw invoiceError;
      }

      // 6. Update order with QPay invoice details
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

      // Check if it's a transaction timeout
      if (error.message && error.message.includes('timeout')) {
        return reply.code(408).send({
          error: 'Order creation timeout',
          details: 'Захиалга үүсгэх хугацаа хэтэрсэн. Дахин оролдоно уу.'
        });
      }

      // Check if it's a database connection error
      if (error.code === 'P1001' || error.code === 'P1002') {
        return reply.code(503).send({
          error: 'Database connection error',
          details: 'Өгөгдлийн санд холбогдож чадсангүй. Түр хүлээгээд дахин оролдоно уу.'
        });
      }

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

    // No N+1 problem: items are stored as JSON in the Order model
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ orders });
  });

  // Get specific order details
  fastify.get('/api/orders/:id', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = (request as any).user.id;

    // Validate order ID parameter
    const paramValidation = validateData(orderIdParamSchema, request.params, reply);
    if (!paramValidation.success) {
      return;
    }

    const { id } = paramValidation.data;

    // No N+1 problem: items are stored as JSON in the Order model
    const order = await prisma.order.findFirst({
      where: {
        id,
        userId // Ensure user can only see their own orders
      }
    });

    if (!order) {
      throw new NotFoundError('Захиалга олдсонгүй');
    }

    return reply.send({ order });
  });

  // Check order payment status (NEW)
  fastify.get('/api/orders/:id/payment-status', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = (request as any).user.id;

    // Validate order ID parameter
    const paramValidation = validateData(orderIdParamSchema, request.params, reply);
    if (!paramValidation.success) {
      return;
    }

    const { id } = paramValidation.data;

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

      // Check with QPay Circuit Breaker if payment completed
      if (order.qpayInvoiceId) {
        const paymentCheck = await qpayCircuitBreaker.checkPayment(order.qpayInvoiceId);

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

