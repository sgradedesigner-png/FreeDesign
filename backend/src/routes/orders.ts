import { logger } from '../lib/logger';
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
import { emailService } from '../services/email.service';
import { ensureCustomizationAssetsOwnedByUser } from '../services/asset.service';

/**
 * Mask email address for privacy in logs (GDPR compliance)
 */
function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!domain) return '***';

  const maskedLocal = localPart.length > 1
    ? `${localPart[0]}***`
    : '***';

  const domainParts = domain.split('.');
  const maskedDomain = domainParts.map(part =>
    part.length > 1 ? `${part[0]}***` : part
  ).join('.');

  return `${maskedLocal}@${maskedDomain}`;
}

/**
 * Helper function to check and update expired orders
 * Checks if order's QPay invoice has expired and updates status to EXPIRED
 */
async function checkAndUpdateExpiredOrders(orders: any[]) {
  const now = new Date();
  const expiredOrderIds: string[] = [];

  // Find orders that are expired
  for (const order of orders) {
    if (
      order.qpayInvoiceExpiresAt &&
      order.status === 'PENDING' &&
      order.paymentStatus === 'UNPAID' &&
      new Date(order.qpayInvoiceExpiresAt) < now
    ) {
      expiredOrderIds.push(order.id);
    }
  }

  // Update expired orders in bulk
  if (expiredOrderIds.length > 0) {
    await prisma.order.updateMany({
      where: {
        id: { in: expiredOrderIds }
      },
      data: {
        status: 'EXPIRED',
        expiredAt: now,
        updatedAt: now
      }
    });

    logger.info({ count: expiredOrderIds.length, orderIds: expiredOrderIds }, '[Order Expiration] Updated expired orders');

    // Update the orders in the array to reflect new status
    for (const order of orders) {
      if (expiredOrderIds.includes(order.id)) {
        order.status = 'EXPIRED';
        order.expiredAt = now;
        order.updatedAt = now;
      }
    }
  }

  return orders;
}

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
      logger.info({ body: request.body }, '[Order Creation] Request body');

      // Validate request body with Zod
      const validation = validateData(createOrderSchema, request.body, reply);
      if (!validation.success) {
        logger.info({ error: validation.error }, '[Order Creation] Validation failed');
        return; // Error response already sent by validateData
      }

      logger.info('[Order Creation] Validation passed');

      const {
        items: rawItems,
        shippingAddress,
        total,
        rushOrder,
        rushFee,
        addOnFees,
      } = validation.data;

      // Normalize items to ensure price field exists
      const items = rawItems.map(item => ({
        ...item,
        price: item.price || item.variantPrice || 0,
        customizations: item.customizations ?? [],
        addOns: item.addOns ?? [],
      }));

      const pendingCustomizations = items.flatMap((item, orderItemIndex) =>
        item.customizations.map((customization) => ({
          orderItemIndex,
          printAreaId: customization.printAreaId,
          printSizeTierId: customization.printSizeTierId,
          assetId: customization.assetId,
          placementConfig: customization.placementConfig ?? undefined,
          printFee: customization.printFee
        }))
      );

      const isCustomOrder = pendingCustomizations.length > 0;

      if (isCustomOrder) {
        const uniqueAssetIds = Array.from(
          new Set(pendingCustomizations.map((customization) => customization.assetId))
        );
        await ensureCustomizationAssetsOwnedByUser(userId, uniqueAssetIds);

        const uniqueVariantIds = Array.from(new Set(items.map((item) => item.id)));
        const variants = await prisma.productVariant.findMany({
          where: { id: { in: uniqueVariantIds } },
          select: {
            id: true,
            product: {
              select: {
                isCustomizable: true,
                printAreas: {
                  select: { printAreaId: true },
                },
              },
            },
          },
        });

        if (variants.length !== uniqueVariantIds.length) {
          throw new BadRequestError('One or more product variants are invalid');
        }

        const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

        for (const customization of pendingCustomizations) {
          const item = items[customization.orderItemIndex];
          const variant = item ? variantMap.get(item.id) : undefined;

          if (!variant) {
            throw new BadRequestError('Customization references an invalid order item');
          }

          if (!variant.product.isCustomizable) {
            throw new BadRequestError('Customization is not allowed for this product variant');
          }

          const configuredAreaIds = new Set(
            variant.product.printAreas.map((row) => row.printAreaId)
          );

          // Backward compatibility: enforce only when explicit areas are configured.
          if (configuredAreaIds.size > 0 && !configuredAreaIds.has(customization.printAreaId)) {
            throw new BadRequestError('Selected print area is not enabled for this product');
          }
        }

        const uniquePrintAreaIds = Array.from(
          new Set(pendingCustomizations.map((customization) => customization.printAreaId))
        );
        const uniquePrintSizeTierIds = Array.from(
          new Set(pendingCustomizations.map((customization) => customization.printSizeTierId))
        );

        const [printAreaCount, printSizeTierCount] = await Promise.all([
          prisma.printArea.count({
            where: {
              id: { in: uniquePrintAreaIds },
              isActive: true
            }
          }),
          prisma.printSizeTier.count({
            where: {
              id: { in: uniquePrintSizeTierIds },
              isActive: true
            }
          })
        ]);

        if (printAreaCount !== uniquePrintAreaIds.length) {
          throw new BadRequestError('One or more print areas are invalid');
        }

        if (printSizeTierCount !== uniquePrintSizeTierIds.length) {
          throw new BadRequestError('One or more print size tiers are invalid');
        }
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

        logger.info({ userId, foundPending: existingPending.length }, '[QPay Cleanup] Found pending orders');

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

          logger.info({ userId, count: existingPending.length }, '[QPay Cleanup] Marked as CANCELLING');
        }

        // 3. Create new order INSIDE transaction (prevents duplicate creation)
        const newOrder = await tx.order.create({
          data: {
            userId,
            total,
            status: 'PENDING',
            isCustomOrder,
            paymentStatus: 'UNPAID',
            paymentMethod: 'QPAY',
            shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
            items: items,
            rushFee: rushOrder && rushFee > 0 ? rushFee : null,
            addOnFees: addOnFees > 0 ? addOnFees : null,
          }
        });

        logger.info({ orderId: newOrder.id, userId }, '[Order Create] New order created');

        if (pendingCustomizations.length > 0) {
          await tx.orderItemCustomization.createMany({
            data: pendingCustomizations.map((customization) => ({
              orderId: newOrder.id,
              orderItemIndex: customization.orderItemIndex,
              printAreaId: customization.printAreaId,
              printSizeTierId: customization.printSizeTierId,
              assetId: customization.assetId,
              placementConfig: customization.placementConfig,
              printFee: customization.printFee
            }))
          });
        }

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
                  logger.info({ invoiceId: oldOrder.qpayInvoiceId }, '[QPay Cleanup] Cancelled invoice');
                  // Mark as CANCELLED after successful cancellation
                  prisma.order.update({
                    where: { id: oldOrder.id },
                    data: {
                      status: 'CANCELLED',
                      qpayInvoiceId: null,
                      qrCode: null,
                      qrCodeUrl: null
                    }
                  }).catch(err => logger.error({ error: err }, 'Failed to update cancelled order'));
                })
                .catch(err => {
                  logger.warn({ invoiceId: oldOrder.qpayInvoiceId, error: err.message }, '[QPay Cleanup] Failed to cancel invoice');
                  // Mark as CANCELLATION_FAILED if QPay cancellation failed
                  prisma.order.update({
                    where: { id: oldOrder.id },
                    data: { status: 'CANCELLATION_FAILED' }
                  }).catch(e => logger.error({ error: e }, 'Failed to mark cancellation failed'));
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
              }).catch(err => logger.error({ error: err }, 'Failed to update cancelled order'));
            }
          });
        });
      }

      // 5. Create QPay invoice with Circuit Breaker (OUTSIDE transaction to avoid blocking)
      let qpayInvoice;
      try {
        logger.info({ orderId: order.id }, '[QPay Invoice] Creating invoice');
        qpayInvoice = await qpayCircuitBreaker.createInvoice({
          orderNumber: order.id,
          amount: Number(total),
          description: `Order #${order.id.substring(0, 8)} - ${items.length} items`,
          callbackUrl
        });
        logger.info({ orderId: order.id, invoiceId: qpayInvoice.invoice_id }, '[QPay Invoice] Invoice created successfully');
      } catch (invoiceError: any) {
        const errorMessage = invoiceError instanceof Error ? invoiceError.message : String(invoiceError);
        logger.error({ orderId: order.id, error: errorMessage }, '[QPay Invoice] Failed to create invoice');

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
      // Phase 1: Set invoice expiration to 48 hours from now
      const qpayInvoiceExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          qpayInvoiceId: qpayInvoice.invoice_id,
          qrCode: qpayInvoice.qr_image, // Base64 QR image
          qrCodeUrl: qpayInvoice.qPay_shortUrl,
          qrText: qpayInvoice.qr_text, // QR text URL for sandbox testing
          qpayInvoiceExpiresAt: qpayInvoiceExpiresAt // 48-hour expiration
        },
        include: {
          customizations: true
        },
      });

      logger.info({ orderId: order.id, userId }, 'Order created with QPay invoice');

      // 7. Send order confirmation email in BACKGROUND (Phase 2)
      // This prevents blocking the response while sending email
      setImmediate(async () => {
        try {
          // Get user's email from profile (id = userId in Profile table)
          const profile = await prisma.profile.findUnique({
            where: { id: userId },
            select: { email: true }
          });

          if (!profile?.email) {
            logger.warn({ userId }, '[Email] No email found for user, skipping confirmation email');
            return;
          }

          const isProduction = process.env.NODE_ENV === 'production';
          const logEmail = isProduction ? maskEmail(profile.email) : profile.email;
          logger.info({ email: logEmail, orderId: updatedOrder.id }, '[Email] Sending order confirmation');

          const emailResult = await emailService.sendOrderConfirmation(profile.email, {
            orderId: updatedOrder.id,
            total: Number(updatedOrder.total), // Convert Decimal to number
            items: updatedOrder.items as any[],
            qrCodeUrl: updatedOrder.qrCodeUrl || undefined,
            qpayInvoiceExpiresAt: updatedOrder.qpayInvoiceExpiresAt || undefined
          });

          if (emailResult.success) {
            // Update order to mark confirmation email as sent
            await prisma.order.update({
              where: { id: updatedOrder.id },
              data: {
                confirmationEmailSent: true,
                confirmationEmailSentAt: new Date()
              }
            });
            logger.info({ email: logEmail }, '[Email] Confirmation email sent successfully');
          } else {
            logger.error({ error: emailResult.error }, '[Email] Failed to send confirmation email');
          }
        } catch (emailError: any) {
          logger.error({ error: emailError.message }, '[Email] Error sending confirmation email');
        }
      });

      // 4. Return order with payment info
      return reply.code(201).send({
        order: updatedOrder,
        payment: {
          qrCode: qpayInvoice.qr_image,
          qrCodeUrl: qpayInvoice.qPay_shortUrl,
          qrText: qpayInvoice.qr_text, // QR text URL for sandbox testing
          bankUrls: qpayInvoice.urls, // Deep links to banking apps
          invoiceId: qpayInvoice.invoice_id
        }
      });
    } catch (error: any) {
      logger.error({ error }, 'Order creation error');

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

      if (error instanceof BadRequestError) {
        return reply.code(400).send({
          error: error.message
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
    let orders = await prisma.order.findMany({
      where: { userId },
      include: {
        customizations: {
          include: {
            printArea: true,
            printSizeTier: true,
            asset: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Check and update expired orders automatically
    orders = await checkAndUpdateExpiredOrders(orders);

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
    let order = await prisma.order.findFirst({
      where: {
        id,
        userId // Ensure user can only see their own orders
      },
      include: {
        customizations: {
          include: {
            printArea: true,
            printSizeTier: true,
            asset: true
          }
        }
      },
    });

    if (!order) {
      throw new NotFoundError('Захиалга олдсонгүй');
    }

    // Check and update if expired
    const updatedOrders = await checkAndUpdateExpiredOrders([order]);
    order = updatedOrders[0];

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
        where: { id, userId },
        include: {
          customizations: true
        }
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
      logger.error({ error }, 'Payment status check error');
      return reply.code(500).send({ error: 'Failed to check payment status' });
    }
  });
}
