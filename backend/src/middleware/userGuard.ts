// backend/src/middleware/userGuard.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { logger, hashIdentifier } from '../lib/logger';

// âœ… ENV ÑˆÐ°Ð°Ñ€Ð´Ð»Ð°Ð³Ð°Ñ‚Ð°Ð¹
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required in backend/.env');
if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY is required in backend/.env');

// âœ… Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * userGuard - Authenticate any confirmed user (not just admins)
 *
 * Purpose: Verify that the request has a valid Supabase JWT token
 * Use for: Customer-facing endpoints (orders, profile, etc.)
 *
 * Difference from adminGuard:
 * - Does NOT check Profile.role
 * - Only verifies valid Supabase JWT
 * - Any authenticated user with confirmed email can access
 */
export async function userGuard(req: FastifyRequest, reply: FastifyReply) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      logger.error({ context: 'userGuard' }, 'Missing Bearer token');
      return reply.status(401).send({ error: 'Unauthorized - No token provided' });
    }

    logger.info({ context: 'userGuard' }, 'Verifying JWT token with Supabase...');

    // âœ… Supabase Ð°ÑˆÐ¸Ð³Ð»Ð°Ð°Ð´ token verify Ñ…Ð¸Ð¹Ð½Ñ
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      logger.error({ context: 'userGuard', error: error?.message }, 'Token verification failed');
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    logger.info({ context: 'userGuard', userIdHash: hashIdentifier(data.user.id) ?? undefined }, 'JWT verified successfully');

    // âœ… Attach user info to request object
    (req as any).user = {
      id: data.user.id,
      email: data.user.email,
      email_confirmed_at: data.user.email_confirmed_at,
    };

    logger.info({ context: 'userGuard', userIdHash: hashIdentifier(data.user.id) ?? undefined }, 'User access granted');

    return; // ok
  } catch (err: any) {
    logger.error({ context: 'userGuard', error: err.message, details: err }, 'Authentication failed');
    return reply.status(401).send({ error: 'Authentication failed' });
  }
}

