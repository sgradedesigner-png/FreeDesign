// backend/src/routes/profile.ts
import { FastifyInstance } from 'fastify';
import { userGuard } from '../middleware/userGuard';
import { prisma } from '../lib/prisma';

export default async function profileRoutes(fastify: FastifyInstance) {

  // Get user profile
  fastify.get('/api/profile', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = (request as any).user.id;

    try {
      let profile = await prisma.profile.findUnique({
        where: { id: userId }
      });

      // Create profile if doesn't exist
      if (!profile) {
        profile = await prisma.profile.create({
          data: {
            id: userId,
            email: (request as any).user.email,
            role: 'CUSTOMER' // Default role
          }
        });

        console.log(`✅ Profile created for user: ${userId}`);
      }

      return reply.send({ profile });
    } catch (error: any) {
      console.error('Fetch profile error:', error);
      return reply.code(500).send({ error: 'Failed to fetch profile' });
    }
  });

  // Update user profile
  fastify.put('/api/profile', {
    preHandler: [userGuard],
    config: {
      rateLimit: {
        max: 10, // 10 profile updates per minute
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const userId = (request as any).user.id;
    const { name, phone, address } = request.body as any;

    try {
      const profile = await prisma.profile.upsert({
        where: { id: userId },
        update: {
          name,
          phone,
          address: address ? JSON.stringify(address) : null
        },
        create: {
          id: userId,
          email: (request as any).user.email,
          name,
          phone,
          address: address ? JSON.stringify(address) : null,
          role: 'CUSTOMER'
        }
      });

      console.log(`✅ Profile updated for user: ${userId}`);

      return reply.send({ profile });
    } catch (error: any) {
      console.error('Update profile error:', error);
      return reply.code(500).send({ error: 'Failed to update profile' });
    }
  });
}
