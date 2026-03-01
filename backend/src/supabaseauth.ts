// backend/src/supabaseauth.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Role } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { prisma } from './lib/prisma';
import { logger, hashIdentifier } from './lib/logger';

// âœ… ENV ÑˆÐ°Ð°Ñ€Ð´Ð»Ð°Ð³Ð°Ñ‚Ð°Ð¹
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required in backend/.env');
if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY is required in backend/.env');

// âœ… Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type SupabaseClaims = {
  sub: string;
  email?: string;
  aud?: string | string[];
  role?: string;
};

export async function adminGuard(req: FastifyRequest, reply: FastifyReply) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      logger.error({ context: 'adminGuard' }, 'Missing Bearer token');
      return reply.status(401).send({ message: 'Missing Bearer token' });
    }

    logger.info({ context: 'adminGuard' }, 'Verifying JWT token with Supabase...');

    // âœ… Supabase Ð°ÑˆÐ¸Ð³Ð»Ð°Ð°Ð´ token verify Ñ…Ð¸Ð¹Ð½Ñ
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      logger.error({ context: 'adminGuard', error: error?.message }, 'Token verification failed');
      return reply.status(401).send({ message: 'Invalid token' });
    }

    logger.info({ context: 'adminGuard', userIdHash: hashIdentifier(data.user.id) ?? undefined }, 'JWT verified successfully');

    const userId = data.user.id;

    // âœ… DB Ð´ÑÑÑ€Ñ… Profile.role ÑˆÐ°Ð»Ð³Ð°Ð½Ð°
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { role: true, email: true, id: true },
    });

    logger.info({ context: 'adminGuard', userIdHash: hashIdentifier(userId) ?? undefined, role: profile?.role ?? null }, 'Profile lookup result');

    if (!profile) {
      logger.error({ context: 'adminGuard', userIdHash: hashIdentifier(userId) ?? undefined }, 'Profile not found for user');
      return reply.status(403).send({ message: 'Profile not found' });
    }

    if (profile.role !== Role.ADMIN) {
      logger.error({ context: 'adminGuard', role: profile.role }, 'User is not ADMIN');
      return reply.status(403).send({ message: 'Admin only' });
    }

    logger.info({ context: 'adminGuard', userIdHash: hashIdentifier(userId) ?? undefined }, 'Admin access granted');

    // Store user info in request
    (req as any).user = {
      sub: userId,
      email: data.user.email,
      role: profile.role,
    };

    return; // ok
  } catch (err: any) {
    logger.error({ context: 'adminGuard', error: err.message, details: err }, 'Authentication failed');
    return reply.status(401).send({ message: 'Authentication failed' });
  }
}

