/**
 * Smoke Test: Guest -> Login Cart Merge (P0-03)
 *
 * This is a small repo-root wrapper so you can run the smoke test via:
 *   node scripts/smoke-cart-merge.js
 *
 * How To Run (PowerShell, from repo root):
 *   $env:VITE_FF_CART_DB_V1='true'
 *   $env:VITE_API_URL='http://localhost:4000'            # or your staging API base
 *   $env:VITE_SUPABASE_URL='https://<project>.supabase.co'
 *   $env:VITE_SUPABASE_ANON_KEY='<anon key>'
 *   $env:SMOKE_EMAIL='your-smoke-user-email'
 *   $env:SMOKE_PASSWORD='your-smoke-user-password'
 *   node scripts/smoke-cart-merge.js
 *
 * Notes:
 * - The actual implementation lives in backend/scripts/smoke-cart-merge.js
 */

require('../backend/scripts/smoke-cart-merge.js');

