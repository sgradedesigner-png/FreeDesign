/**
 * Smoke Test: Guest -> Login Cart Merge (P0-03)
 *
 * Goal:
 * - Create a guest cart item (via X-Guest-Cart-Id)
 * - Log in as a real existing Supabase user
 * - Call POST /api/cart/merge
 * - Verify the item appears in the authenticated cart
 *
 * How To Run (PowerShell):
 *   # Tip: you can put SMOKE_EMAIL/SMOKE_PASSWORD in backend/.env.local (gitignored)
 *   cd backend
 *   $env:VITE_FF_CART_DB_V1='true'
 *   $env:VITE_API_URL='http://localhost:4000'            # or your staging API base
 *   $env:VITE_SUPABASE_URL='https://<project>.supabase.co'
 *   $env:VITE_SUPABASE_ANON_KEY='<anon key>'
 *   $env:SMOKE_EMAIL='your-smoke-user-email'
 *   $env:SMOKE_PASSWORD='your-smoke-user-password'
 *   node scripts/smoke-cart-merge.js
 *
 * Required Env Vars:
 * - VITE_FF_CART_DB_V1=true
 * - VITE_API_URL
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 * - SMOKE_EMAIL
 * - SMOKE_PASSWORD
 *
 * Notes:
 * - This script does NOT touch Supabase Auth tables (auth.users/auth.identities).
 * - For cart FK integrity, it will upsert public.profiles for the authenticated user if missing.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const parsed = dotenv.parse(fs.readFileSync(filePath));
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function apiRequest(apiBase, route, { method = 'GET', token, guestCartId, body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (guestCartId) headers['X-Guest-Cart-Id'] = guestCartId;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${apiBase}${route}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return { ok: response.ok, status: response.status, data };
}

async function ensureProfile(prisma, userId, email) {
  await prisma.profile.upsert({
    where: { id: userId },
    update: { email },
    create: { id: userId, email },
  });
}

function safeRandomId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..', '..');

  // Convenience local loading. Explicit process env always wins.
  loadEnv(path.join(repoRoot, 'backend', '.env.local'));
  loadEnv(path.join(repoRoot, 'backend', '.env'));
  loadEnv(path.join(repoRoot, 'apps', 'store', '.env.local'));
  loadEnv(path.join(repoRoot, 'apps', 'store', '.env'));
  loadEnv(path.join(repoRoot, 'apps', 'store', '.env.staging'));

  const featureFlag = process.env.VITE_FF_CART_DB_V1;
  assert(featureFlag === 'true', 'VITE_FF_CART_DB_V1 must be true for this smoke test');

  const apiBase = process.env.VITE_API_URL;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const smokeEmail = process.env.SMOKE_EMAIL;
  const smokePassword = process.env.SMOKE_PASSWORD;

  assert(apiBase, 'VITE_API_URL is required');
  assert(supabaseUrl, 'VITE_SUPABASE_URL is required');
  assert(supabaseAnonKey, 'VITE_SUPABASE_ANON_KEY is required');
  assert(smokeEmail, 'SMOKE_EMAIL is required');
  assert(smokePassword, 'SMOKE_PASSWORD is required');

  assert(!apiBase.includes('yourdomain.com'), 'VITE_API_URL still contains placeholder yourdomain.com');
  assert(!supabaseUrl.includes('your-'), 'VITE_SUPABASE_URL still contains placeholder your-');

  const prisma = new PrismaClient();
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const guestCartId = safeRandomId('guest_smoke');
  const cartKey = safeRandomId('cartkey_smoke');

  const guestItem = {
    cartKey,
    quantity: 1,
    productId: 'smoke-product-id',
    productName: 'Smoke Product',
    productSlug: 'smoke-product',
    productCategory: 'smoke',
    variantId: 'smoke-variant-id',
    variantName: 'Smoke Variant',
    variantPrice: 99,
    variantOriginalPrice: null,
    variantImage: '/smoke.png',
    variantSku: 'SMOKE-SKU',
    size: null,
    isCustomized: false,
    optionPayload: {},
  };

  try {
    // 1) Guest add -> guest read
    const guestUpsert = await apiRequest(apiBase, '/api/cart/items', {
      method: 'PUT',
      guestCartId,
      body: guestItem,
    });
    assert(guestUpsert.ok, `Guest upsert failed (${guestUpsert.status})`);

    const guestRead = await apiRequest(apiBase, '/api/cart', {
      method: 'GET',
      guestCartId,
    });
    assert(guestRead.ok, `Guest read failed (${guestRead.status})`);

    const guestItems = guestRead.data?.cart?.items || [];
    assert(Array.isArray(guestItems), 'Guest cart response missing items array');
    assert(guestItems.some((i) => i.cartKey === cartKey), 'Guest cart does not contain smoke item');

    // 2) Login as real smoke user
    const signInRes = await supabase.auth.signInWithPassword({
      email: smokeEmail,
      password: smokePassword,
    });

    if (signInRes.error) {
      throw new Error(`Supabase signIn failed: ${signInRes.error.message}`);
    }

    const token = signInRes.data?.session?.access_token || null;
    const userId = signInRes.data?.user?.id || signInRes.data?.session?.user?.id || null;

    assert(token, 'No access token returned from signIn');
    assert(userId, 'No user id returned from signIn');

    // 3) Ensure public.profiles exists for this auth user (cart FK integrity)
    await ensureProfile(prisma, userId, smokeEmail);

    // 4) Merge guest cart into user cart
    const mergeRes = await apiRequest(apiBase, '/api/cart/merge', {
      method: 'POST',
      token,
      guestCartId,
      body: { guestCartId },
    });
    assert(mergeRes.ok, `Cart merge failed (${mergeRes.status})`);

    // 5) Verify merged item exists in authenticated cart
    const authRead = await apiRequest(apiBase, '/api/cart', {
      method: 'GET',
      token,
      guestCartId,
    });
    assert(authRead.ok, `Authenticated cart read failed (${authRead.status})`);

    const authItems = authRead.data?.cart?.items || [];
    assert(Array.isArray(authItems), 'Authenticated cart response missing items array');
    assert(authItems.some((i) => i.cartKey === cartKey), 'Merged user cart does not contain guest smoke item');

    // 6) Cleanup: remove smoke item from user cart; remove abandoned guest cart row.
    await apiRequest(apiBase, `/api/cart/items/${encodeURIComponent(cartKey)}`, {
      method: 'DELETE',
      token,
      guestCartId,
    });

    try {
      await prisma.cart.deleteMany({ where: { guestCartId } });
    } catch {
      // ignore cleanup failures
    }

    console.log('SMOKE_TEST_RESULT: PASS');
    console.log(`DETAIL: guest->login merge verified, item ${cartKey} present after merge`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('SMOKE_TEST_RESULT: FAIL');
  console.error(`DETAIL: ${error.message}`);
  process.exit(1);
});
