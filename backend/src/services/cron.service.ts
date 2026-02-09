// backend/src/services/cron.service.ts
import * as cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { emailService } from './email.service';

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

class CronService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  // Maximum emails to send per cron run (prevents email bombing)
  private readonly MAX_EMAILS_PER_RUN = parseInt(process.env.CRON_MAX_EMAILS_PER_RUN || '50', 10);

  /**
   * Initialize all cron jobs
   */
  async start() {
    console.log('[Cron Service] Starting cron jobs...');

    // Run every hour: Check for orders expiring in 24 hours and send warning emails
    const warningJob = cron.schedule('0 * * * *', async () => {
      await this.checkExpirationWarnings();
    });
    this.jobs.set('expiration-warnings', warningJob);

    // Run every hour: Check for expired orders and send expired emails
    const expiredJob = cron.schedule('0 * * * *', async () => {
      await this.checkExpiredOrders();
    });
    this.jobs.set('expired-orders', expiredJob);

    console.log('[Cron Service] ✅ All cron jobs started successfully');
    console.log('[Cron Service] - Expiration warnings: Every hour (0 * * * *)');
    console.log('[Cron Service] - Expired orders: Every hour (0 * * * *)');

    // Run immediately on startup for testing
    if (process.env.CRON_RUN_ON_STARTUP === 'true') {
      console.log('[Cron Service] Running initial checks...');
      await this.checkExpirationWarnings();
      await this.checkExpiredOrders();
    }
  }

  /**
   * Stop all cron jobs
   */
  stop() {
    console.log('[Cron Service] Stopping all cron jobs...');
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`[Cron Service] Stopped: ${name}`);
    });
    this.jobs.clear();
  }

  /**
   * Check for orders expiring in 24 hours and send warning emails
   * Only sends to orders that haven't received warning email yet
   */
  private async checkExpirationWarnings() {
    try {
      console.log('[Cron: Expiration Warnings] Starting check...');

      const now = new Date();
      const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

      // Find orders expiring in 24-25 hours that haven't received warning email
      const ordersToWarn = await prisma.order.findMany({
        where: {
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          qpayInvoiceExpiresAt: {
            gte: twentyFourHoursFromNow,
            lte: twentyFiveHoursFromNow
          },
          expirationWarningEmailSent: false
        },
        include: {
          user: {
            select: {
              email: true
            }
          }
        }
      });

      if (ordersToWarn.length === 0) {
        console.log('[Cron: Expiration Warnings] No orders found requiring warnings');
        return;
      }

      // Apply batch limit to prevent email bombing
      const limitedOrders = ordersToWarn.slice(0, this.MAX_EMAILS_PER_RUN);
      if (ordersToWarn.length > this.MAX_EMAILS_PER_RUN) {
        console.warn(`[Cron: Expiration Warnings] Limiting to ${this.MAX_EMAILS_PER_RUN} emails (found ${ordersToWarn.length} total)`);
      }

      console.log(`[Cron: Expiration Warnings] Processing ${limitedOrders.length} orders`);

      // Send warning emails
      let emailsSent = 0;
      for (const order of limitedOrders) {
        const email = order.user?.email;
        if (!email) {
          console.warn(`[Cron: Expiration Warnings] No email found for order ${order.id}, skipping`);
          continue;
        }

        try {
          const isProduction = process.env.NODE_ENV === 'production';
          const logEmail = isProduction ? maskEmail(email) : email;
          console.log(`[Cron: Expiration Warnings] Sending warning to ${logEmail} for order ${order.id}`);

          const emailResult = await emailService.sendExpirationWarning(email, {
            orderId: order.id,
            total: Number(order.total), // Convert Decimal to number
            qrCodeUrl: order.qrCodeUrl || undefined,
            hoursRemaining: 24
          });

          if (emailResult.success) {
            // Mark warning email as sent
            await prisma.order.update({
              where: { id: order.id },
              data: {
                expirationWarningEmailSent: true,
                expirationWarningEmailSentAt: now
              }
            });
            emailsSent++;
            console.log(`[Cron: Expiration Warnings] ✅ Warning email sent to ${logEmail} for order ${order.id}`);
          } else {
            console.error(`[Cron: Expiration Warnings] Failed to send warning email: ${emailResult.error}`);
          }
        } catch (error: any) {
          console.error(`[Cron: Expiration Warnings] Error sending warning for order ${order.id}:`, error.message);
        }
      }

      console.log(`[Cron: Expiration Warnings] ✅ Completed - sent ${emailsSent}/${ordersToWarn.length} warning emails`);
    } catch (error: any) {
      console.error('[Cron: Expiration Warnings] Error:', error.message);
    }
  }

  /**
   * Check for expired orders and send expired emails
   * Updates order status to EXPIRED and sends notification
   */
  private async checkExpiredOrders() {
    try {
      console.log('[Cron: Expired Orders] Starting check...');

      const now = new Date();

      // Find orders that have expired
      const expiredOrders = await prisma.order.findMany({
        where: {
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          qpayInvoiceExpiresAt: {
            lt: now
          }
        },
        include: {
          user: {
            select: {
              email: true
            }
          }
        }
      });

      if (expiredOrders.length === 0) {
        console.log('[Cron: Expired Orders] No expired orders found');
        return;
      }

      // Apply batch limit to prevent email bombing
      const limitedOrders = expiredOrders.slice(0, this.MAX_EMAILS_PER_RUN);
      if (expiredOrders.length > this.MAX_EMAILS_PER_RUN) {
        console.warn(`[Cron: Expired Orders] Limiting to ${this.MAX_EMAILS_PER_RUN} emails (found ${expiredOrders.length} total)`);
      }

      console.log(`[Cron: Expired Orders] Processing ${limitedOrders.length} orders`);

      // Process expired orders
      let emailsSent = 0;
      for (const order of limitedOrders) {
        try {
          // Update order status to EXPIRED
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: 'EXPIRED',
              expiredAt: now
            }
          });

          console.log(`[Cron: Expired Orders] Marked order ${order.id} as EXPIRED`);

          // Send expired email if not already sent
          if (!order.expiredEmailSent) {
            const email = order.user?.email;
            if (!email) {
              console.warn(`[Cron: Expired Orders] No email found for order ${order.id}, skipping email`);
              continue;
            }

            const isProduction = process.env.NODE_ENV === 'production';
            const logEmail = isProduction ? maskEmail(email) : email;
            console.log(`[Cron: Expired Orders] Sending expired notification to ${logEmail} for order ${order.id}`);

            const emailResult = await emailService.sendOrderExpired(email, {
              orderId: order.id,
              total: Number(order.total) // Convert Decimal to number
            });

            if (emailResult.success) {
              // Mark expired email as sent
              await prisma.order.update({
                where: { id: order.id },
                data: {
                  expiredEmailSent: true,
                  expiredEmailSentAt: now
                }
              });
              emailsSent++;
              console.log(`[Cron: Expired Orders] ✅ Expired email sent to ${logEmail} for order ${order.id}`);
            } else {
              console.error(`[Cron: Expired Orders] Failed to send expired email: ${emailResult.error}`);
            }
          }
        } catch (error: any) {
          console.error(`[Cron: Expired Orders] Error processing order ${order.id}:`, error.message);
        }
      }

      console.log(`[Cron: Expired Orders] ✅ Completed - processed ${limitedOrders.length} orders, sent ${emailsSent} emails (total found: ${expiredOrders.length})`);
    } catch (error: any) {
      console.error('[Cron: Expired Orders] Error:', error.message);
    }
  }

  /**
   * Manually trigger expiration warnings check (for testing)
   */
  async triggerExpirationWarnings() {
    console.log('[Cron Service] Manually triggering expiration warnings check...');
    await this.checkExpirationWarnings();
  }

  /**
   * Manually trigger expired orders check (for testing)
   */
  async triggerExpiredOrders() {
    console.log('[Cron Service] Manually triggering expired orders check...');
    await this.checkExpiredOrders();
  }
}

// Export singleton instance
export const cronService = new CronService();
