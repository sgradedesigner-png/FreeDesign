// backend/src/auth.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify(); // ✅ cookie эсвэл bearer хоёуланг нь шалгана
  } catch (err) {
    return reply.status(401).send({ message: 'Unauthorized' });
  }
}

export function adminGuard(app: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const user = request.user as any;
      if (user?.role !== 'ADMIN') {
        return reply.status(403).send({ message: 'Forbidden' });
      }
    } catch (err) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
  };
}
