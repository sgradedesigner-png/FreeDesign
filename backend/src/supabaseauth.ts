// backend/src/supabaseauth.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Role } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { prisma } from './lib/prisma';

// ✅ ENV шаардлагатай
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required in backend/.env');
if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY is required in backend/.env');

// ✅ Supabase client
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
      console.error('[adminGuard] Missing Bearer token');
      return reply.status(401).send({ message: 'Missing Bearer token' });
    }

    console.log('[adminGuard] Verifying JWT token with Supabase...');

    // ✅ Supabase ашиглаад token verify хийнэ
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      console.error('[adminGuard] Token verification failed:', error?.message);
      return reply.status(401).send({ message: 'Invalid token' });
    }

    console.log('[adminGuard] ✅ JWT verified successfully');
    console.log('[adminGuard] User ID:', data.user.id);

    const userId = data.user.id;

    // ✅ DB дээрх Profile.role шалгана
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { role: true, email: true, id: true },
    });

    console.log('[adminGuard] Profile:', profile);

    if (!profile) {
      console.error('[adminGuard] Profile not found for user:', userId);
      return reply.status(403).send({ message: 'Profile not found' });
    }

    if (profile.role !== Role.ADMIN) {
      console.error('[adminGuard] User is not ADMIN, role:', profile.role);
      return reply.status(403).send({ message: 'Admin only' });
    }

    console.log('[adminGuard] ✅ Admin access granted to', profile.email);

    // Store user info in request
    (req as any).user = {
      sub: userId,
      email: data.user.email,
      role: profile.role,
    };

    return; // ok
  } catch (err: any) {
    console.error('[adminGuard] ❌ Error:', err.message);
    console.error('[adminGuard] Error details:', err);
    return reply.status(401).send({ message: 'Authentication failed', error: err.message });
  }
}
