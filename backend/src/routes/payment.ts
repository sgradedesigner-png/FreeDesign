// backend/src/routes/payment.ts
import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma';
import { userGuard } from '../middleware/userGuard';
import { qpayService } from '../services/qpay.service';
import { qpayCircuitBreaker } from '../services/qpay-circuit-breaker.service';
import { verifyPaymentSchema } from '../schemas/verify-payment.schema';
import { validateData } from '../utils/validation';

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

function getHeaderString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function safeCompareHex(expectedHex: string, actualHex: string): boolean {
  const expectedBuffer = Buffer.from(expectedHex, 'hex');
  const actualBuffer = Buffer.from(actualHex, 'hex');
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function resolveRequestIps(request: any): string[] {
  const ips = new Set<string>();
  if (typeof request.ip === 'string' && request.ip.trim()) {
    ips.add(request.ip.trim());
  }
  const forwardedFor = getHeaderString(request.headers['x-forwarded-for']);
  if (forwardedFor) {
    forwardedFor
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((ip) => ips.add(ip));
  }
  const realIp = getHeaderString(request.headers['x-real-ip']);
  if (realIp?.trim()) {
    ips.add(realIp.trim());
  }
  return Array.from(ips);
}

export default async function paymentRoutes(fastify: FastifyInstance) {
  /**
   * QPay payment callback webhook
   * Accepts query/body variations to be compatible with sandbox and production callbacks.
   */
  fastify.post('/api/payment/callback', {
    config: {
      rateLimit: {
        max: 20, // 20 webhooks per minute (QPay can send duplicates)
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const body = ((request.body ?? {}) as Record<string, unknown>);
    const query = ((request.query ?? {}) as Record<string, unknown>);
    const callbackSecret = process.env.QPAY_CALLBACK_SECRET?.trim();
    const callbackAllowlist = (process.env.QPAY_CALLBACK_ALLOWED_IPS ?? '')
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);

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

    if (callbackAllowlist.length > 0) {
      const requestIps = resolveRequestIps(request as any);
      const isAllowed = requestIps.some((ip) => callbackAllowlist.includes(ip));
      if (!isAllowed) {
        fastify.log.warn({ requestIps }, 'Blocked callback from non-allowlisted IP');
        return reply.code(403).send({ error: 'Forbidden callback source' });
      }
    }

    if (callbackSecret) {
      const signature = getHeaderString(request.headers['x-qpay-signature'])?.trim().toLowerCase();
      if (!signature || !/^[a-f0-9]{64}$/.test(signature)) {
        return reply.code(401).send({ error: 'Invalid callback signature' });
      }

      const payload = JSON.stringify({
        paymentId,
        invoiceId: invoiceId ?? null,
        orderId: orderId ?? null,
      });
      const expectedSignature = crypto
        .createHmac('sha256', callbackSecret)
        .update(payload)
        .digest('hex');

      if (!safeCompareHex(expectedSignature, signature)) {
        fastify.log.warn({ paymentId }, 'Rejected callback with invalid signature');
        return reply.code(401).send({ error: 'Invalid callback signature' });
      }
    }

    fastify.log.info({ paymentId, invoiceId, orderId }, 'QPay callback received');

    try {
      // Use transaction for idempotency: ensure webhook is processed exactly once
      const result = await prisma.$transaction(async (tx) => {
        // 1. Check if this webhook was already processed (idempotency check)
        const existingLog = await tx.paymentWebhookLog.findUnique({
          where: { paymentId }
        });

        if (existingLog) {
          fastify.log.info({ paymentId, existingStatus: existingLog.status }, 'Duplicate webhook detected');
          return {
            isDuplicate: true,
            status: existingLog.status,
            orderId: existingLog.orderId
          };
        }

        // 2. Create webhook log IMMEDIATELY (claims this payment_id)
        const webhookLog = await tx.paymentWebhookLog.create({
          data: {
            paymentId,
            invoiceId: invoiceId || null,
            status: 'processing',
            payload: JSON.parse(JSON.stringify({ body, query })), // Ensure JSON serializable
            receivedAt: new Date()
          }
        });

        // 3. Find the order
        const order = await tx.order.findFirst({
          where: orderId ? { id: orderId } : { qpayInvoiceId: invoiceId }
        });

        if (!order) {
          // Mark webhook as invalid
          await tx.paymentWebhookLog.update({
            where: { id: webhookLog.id },
            data: {
              status: 'invalid',
              error: 'Order not found',
              processedAt: new Date()
            }
          });

          throw new Error('Order not found for callback');
        }

        // 4. Check if order is already paid
        if (order.paymentStatus === 'PAID') {
          await tx.paymentWebhookLog.update({
            where: { id: webhookLog.id },
            data: {
              status: 'duplicate',
              orderId: order.id,
              error: 'Order already paid',
              processedAt: new Date()
            }
          });

          return {
            isDuplicate: true,
            status: 'already_paid',
            orderId: order.id
          };
        }

        // 5. Verify payment with QPay API (outside transaction to avoid long locks)
        // NOTE: This is safe because we've already claimed the paymentId above
        return {
          isDuplicate: false,
          webhookLogId: webhookLog.id,
          order: order, // TypeScript: order is guaranteed to be defined here
          invoiceId: invoiceId || null
        };
      }, {
        timeout: 10000,
        isolationLevel: 'Serializable'
      });

      // Handle duplicate webhooks
      if (result.isDuplicate) {
        return reply.send({
          status: result.status,
          order_id: result.orderId,
          message: 'Webhook already processed'
        });
      }

      // 6. Verify payment against QPay API with Circuit Breaker (outside transaction)
      // At this point, result.order is guaranteed to be defined (isDuplicate=false)
      const paymentData = await qpayCircuitBreaker.getPayment(paymentId);

      // 6a. SECURITY: Strict invoice binding — prevent payment replay attacks
      const qpayInvoiceRef = getFirstString(
        (paymentData as any)?.invoice_id,
        (paymentData as any)?.sender_invoice_no,
        (paymentData as any)?.rows?.[0]?.sender_invoice_no,
        (paymentData as any)?.rows?.[0]?.invoice_id
      );

      if (qpayInvoiceRef && result.order!.qpayInvoiceId
        && qpayInvoiceRef !== result.order!.qpayInvoiceId) {
        fastify.log.error(
          { paymentId, orderId: result.order!.id, expected: result.order!.qpayInvoiceId, got: qpayInvoiceRef },
          'SECURITY: Invoice mismatch — possible payment replay attack'
        );

        await prisma.paymentWebhookLog.update({
          where: { id: result.webhookLogId },
          data: {
            status: 'failed',
            orderId: result.order!.id,
            error: `Invoice mismatch: expected=${result.order!.qpayInvoiceId}, got=${qpayInvoiceRef}`,
            processedAt: new Date()
          }
        });

        return reply.code(400).send({ error: 'Invoice mismatch' });
      }

      const externalStatus = getFirstString(
        (paymentData as any)?.payment_status,
        (paymentData as any)?.status,
        (paymentData as any)?.rows?.[0]?.payment_status
      )?.toUpperCase();

      if (externalStatus && externalStatus !== 'PAID') {
        // Update webhook log as not_paid
        await prisma.paymentWebhookLog.update({
          where: { id: result.webhookLogId },
          data: {
            status: 'not_paid',
            orderId: result.order!.id, // Non-null assertion: order is defined
            error: `Payment status is ${externalStatus}`,
            processedAt: new Date()
          }
        });

        return reply.send({
          status: 'not_paid',
          order_id: result.order!.id
        });
      }

      // 7. Validate payment amount
      const paidAmount = toFiniteNumber(
        (paymentData as any)?.payment_amount ??
        (paymentData as any)?.amount ??
        (paymentData as any)?.rows?.[0]?.payment_amount
      );
      const orderAmount = Number(result.order!.total);

      if (paidAmount !== undefined && Math.abs(paidAmount - orderAmount) > 0.01) {
        fastify.log.error(
          { paymentId, orderId: result.order!.id, invoiceId, paidAmount, orderAmount },
          'QPay callback amount mismatch'
        );

        await prisma.paymentWebhookLog.update({
          where: { id: result.webhookLogId },
          data: {
            status: 'failed',
            orderId: result.order!.id,
            error: `Amount mismatch: paid=${paidAmount}, order=${orderAmount}`,
            processedAt: new Date()
          }
        });

        return reply.code(400).send({ error: 'Paid amount mismatch' });
      }

      // 8. Extract payment date
      const paymentDateRaw = getFirstString(
        (paymentData as any)?.payment_date,
        (paymentData as any)?.paid_at,
        (paymentData as any)?.rows?.[0]?.payment_date
      );
      const parsedPaymentDate = paymentDateRaw ? new Date(paymentDateRaw) : new Date();
      const paymentDate = Number.isNaN(parsedPaymentDate.getTime()) ? new Date() : parsedPaymentDate;

      // 9. Update order and webhook log atomically
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: result.order!.id },
          data: {
            paymentStatus: 'PAID',
            qpayPaymentId: paymentId,
            paymentDate,
            status: 'PAID'
          }
        });

        await tx.paymentWebhookLog.update({
          where: { id: result.webhookLogId },
          data: {
            status: 'success',
            orderId: result.order!.id,
            processedAt: new Date()
          }
        });
      });

      fastify.log.info({ paymentId, orderId: result.order!.id, invoiceId }, 'QPay payment confirmed');

      return reply.send({
        status: 'success',
        order_id: result.order!.id,
        payment_id: paymentId
      });

    } catch (error) {
      fastify.log.error({ err: error, paymentId, invoiceId }, 'Payment callback error');

      // Try to log the error in webhook log
      if (paymentId) {
        await prisma.paymentWebhookLog.upsert({
          where: { paymentId },
          create: {
            paymentId,
            invoiceId: invoiceId || null,
            status: 'failed',
            payload: JSON.parse(JSON.stringify({ body, query })),
            error: error instanceof Error ? error.message : String(error),
            processedAt: new Date()
          },
          update: {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            processedAt: new Date()
          }
        }).catch(() => null); // Ignore logging errors
      }

      return reply.code(500).send({ error: 'Payment processing failed' });
    }
  });

  /**
   * Manual payment verification endpoint for frontend polling fallback.
   * Protected and user-scoped.
   * This endpoint also uses transaction to prevent race conditions during polling.
   */
  fastify.post(
    '/api/payment/verify',
    {
      preHandler: [userGuard],
      config: {
        rateLimit: {
          max: 10, // 10 verifications per minute (for polling)
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => {
      const userId = (request as any).user.id as string;

      // Validate request body
      const validation = validateData(verifyPaymentSchema, request.body, reply);
      if (!validation.success) {
        return;
      }

      const { orderId } = validation.data;

      try {
        const order = await prisma.order.findFirst({
          where: { id: orderId, userId }
        });

        if (!order || !order.qpayInvoiceId) {
          return reply.code(404).send({ error: 'Order not found' });
        }

        // If already paid, return immediately
        if (order.paymentStatus === 'PAID') {
          return reply.send({
            paid: true,
            payment_id: order.qpayPaymentId
          });
        }

        // Check payment status with QPay Circuit Breaker
        const paymentCheck = await qpayCircuitBreaker.checkPayment(order.qpayInvoiceId);

        if (paymentCheck.count > 0 && paymentCheck.rows[0].payment_status === 'PAID') {
          const payment = paymentCheck.rows[0];

          // SECURITY: Strict invoice binding — verify payment belongs to this order
          const verifyInvoiceRef = (payment as any).sender_invoice_no || (payment as any).invoice_id;
          if (verifyInvoiceRef && order.qpayInvoiceId
            && verifyInvoiceRef !== order.qpayInvoiceId) {
            fastify.log.error(
              { orderId, expected: order.qpayInvoiceId, got: verifyInvoiceRef },
              'SECURITY: Invoice mismatch in manual verification'
            );
            return reply.code(400).send({ error: 'Invoice mismatch' });
          }

          // Use transaction to prevent race condition with webhook
          const result = await prisma.$transaction(async (tx) => {
            // Re-check order status inside transaction
            const currentOrder = await tx.order.findUnique({
              where: { id: order.id }
            });

            if (!currentOrder) {
              throw new Error('Order not found');
            }

            // If already paid by webhook, just return
            if (currentOrder.paymentStatus === 'PAID') {
              return {
                alreadyPaid: true,
                paymentId: currentOrder.qpayPaymentId
              };
            }

            // Update order to PAID
            await tx.order.update({
              where: { id: order.id },
              data: {
                paymentStatus: 'PAID',
                qpayPaymentId: payment.payment_id,
                paymentDate: new Date(payment.payment_date),
                status: 'PAID'
              }
            });

            // Log this as a manual verification (not from webhook)
            await tx.paymentWebhookLog.upsert({
              where: { paymentId: payment.payment_id },
              create: {
                paymentId: payment.payment_id,
                invoiceId: order.qpayInvoiceId,
                orderId: order.id,
                status: 'success',
                payload: { source: 'manual_verification', userId },
                processedAt: new Date()
              },
              update: {
                // If webhook already logged it, don't overwrite
              }
            });

            return {
              alreadyPaid: false,
              paymentId: payment.payment_id
            };
          });

          fastify.log.info(
            { orderId, paymentId: payment.payment_id, alreadyPaid: result.alreadyPaid },
            'Payment verified manually'
          );

          return reply.send({
            paid: true,
            payment_id: result.paymentId
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
