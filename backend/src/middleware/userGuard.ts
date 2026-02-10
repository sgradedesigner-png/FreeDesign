import { logger } from '../lib/logger';
// backend/src/middleware/userGuard.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';

// ✅ ENV шаардлагатай
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required in backend/.env');
if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY is required in backend/.env');

// ✅ Supabase client
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
      logger.error('[userGuard] Missing Bearer token');
      return reply.status(401).send({ error: 'Unauthorized - No token provided' });
    }

    logger.info('[userGuard] Verifying JWT token with Supabase...');

    // ✅ Supabase ашиглаад token verify хийнэ
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      logger.error('[userGuard] Token verification failed:', error?.message);
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    logger.info('[userGuard] ✅ JWT verified successfully');
    logger.info('[userGuard] User ID:', data.user.id);
    logger.info('[userGuard] User email:', data.user.email);

    // ✅ Attach user info to request object
    (req as any).user = {
      id: data.user.id,
      email: data.user.email,
      email_confirmed_at: data.user.email_confirmed_at,
    };

    logger.info('[userGuard] ✅ User access granted to', data.user.email);

    return; // ok
  } catch (err: any) {
    logger.error('[userGuard] ❌ Error:', err.message);
    logger.error('[userGuard] Error details:', err);
    return reply.status(500).send({ error: 'Authentication failed', details: err.message });
  }
}
