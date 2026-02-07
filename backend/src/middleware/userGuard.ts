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
      console.error('[userGuard] Missing Bearer token');
      return reply.status(401).send({ error: 'Unauthorized - No token provided' });
    }

    console.log('[userGuard] Verifying JWT token with Supabase...');

    // ✅ Supabase ашиглаад token verify хийнэ
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      console.error('[userGuard] Token verification failed:', error?.message);
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    console.log('[userGuard] ✅ JWT verified successfully');
    console.log('[userGuard] User ID:', data.user.id);
    console.log('[userGuard] User email:', data.user.email);

    // ✅ Attach user info to request object
    (req as any).user = {
      id: data.user.id,
      email: data.user.email,
      email_confirmed_at: data.user.email_confirmed_at,
    };

    console.log('[userGuard] ✅ User access granted to', data.user.email);

    return; // ok
  } catch (err: any) {
    console.error('[userGuard] ❌ Error:', err.message);
    console.error('[userGuard] Error details:', err);
    return reply.status(500).send({ error: 'Authentication failed', details: err.message });
  }
}
