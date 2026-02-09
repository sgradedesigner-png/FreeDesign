// backend/src/routes/admin/cron.ts
import { FastifyInstance } from 'fastify';
import { adminGuard } from '../../supabaseauth';
import { cronService } from '../../services/cron.service';

/**
 * Admin endpoints for manually triggering cron jobs
 * Useful for testing and debugging email notifications
 */
export default async function adminCronRoutes(fastify: FastifyInstance) {

  // Manually trigger expiration warnings check
  fastify.post('/admin/cron/expiration-warnings', {
    preHandler: [adminGuard]
  }, async (request, reply) => {
    try {
      fastify.log.info('[Admin Cron] Manually triggering expiration warnings check...');

      // Run in background to avoid blocking response
      setImmediate(async () => {
        await cronService.triggerExpirationWarnings();
      });

      return reply.code(200).send({
        message: 'Expiration warnings check triggered successfully',
        note: 'Check server logs for results'
      });
    } catch (error: any) {
      fastify.log.error('[Admin Cron] Error triggering expiration warnings:', error);
      return reply.code(500).send({
        error: 'Failed to trigger expiration warnings check',
        details: error.message
      });
    }
  });

  // Manually trigger expired orders check
  fastify.post('/admin/cron/expired-orders', {
    preHandler: [adminGuard]
  }, async (request, reply) => {
    try {
      fastify.log.info('[Admin Cron] Manually triggering expired orders check...');

      // Run in background to avoid blocking response
      setImmediate(async () => {
        await cronService.triggerExpiredOrders();
      });

      return reply.code(200).send({
        message: 'Expired orders check triggered successfully',
        note: 'Check server logs for results'
      });
    } catch (error: any) {
      fastify.log.error('[Admin Cron] Error triggering expired orders:', error);
      return reply.code(500).send({
        error: 'Failed to trigger expired orders check',
        details: error.message
      });
    }
  });

  // Trigger all cron jobs at once
  fastify.post('/admin/cron/trigger-all', {
    preHandler: [adminGuard]
  }, async (request, reply) => {
    try {
      fastify.log.info('[Admin Cron] Manually triggering all cron jobs...');

      // Run in background to avoid blocking response
      setImmediate(async () => {
        await cronService.triggerExpirationWarnings();
        await cronService.triggerExpiredOrders();
      });

      return reply.code(200).send({
        message: 'All cron jobs triggered successfully',
        note: 'Check server logs for results'
      });
    } catch (error: any) {
      fastify.log.error('[Admin Cron] Error triggering all cron jobs:', error);
      return reply.code(500).send({
        error: 'Failed to trigger all cron jobs',
        details: error.message
      });
    }
  });

}
