# Phase 0 Tickets: Foundation and Safety

## Phase Objective
Phase 0 stabilizes architecture and security before storefront refactors. It codifies schema and policy foundations, introduces feature flags, secures upload boundaries, and adds observability so later phases can ship without regressions to existing checkout and production flows.

## P0-01 Add Product Family Metadata and Feature Flags Baseline
- Scope: Introduce explicit product family metadata so storefront templates can branch by family (`by_size`, `gang_upload`, `gang_builder`, `blanks`, `uv_*`) without hardcoded slug checks.
- Files to touch: `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260215090000_phase0_product_family/migration.sql` (NEW), `backend/src/routes/admin/products.ts`, `backend/src/routes/products.ts`, `apps/admin/src/pages/ProductFormPage.tsx`, `apps/store/src/data/types.ts`, `apps/store/src/data/products.api.ts`, `apps/store/src/data/products.ts`.
- Database changes: Add enum `ProductFamily`; add `products.product_family`, `products.product_subfamily`, `products.requires_upload`, `products.requires_builder`, `products.upload_profile_id`; add index `products(product_family, is_published)`; keep existing `is_published` naming convention.
- Backend changes: Validate family fields on admin create/update; include new fields in public product responses; keep defaults for legacy products (`blanks`).
- Frontend changes: Extend product types/mappers with family fields; keep backward compatibility for existing product detail rendering.
- Acceptance criteria:
- Admin can set product family and save without schema errors.
- Public product queries include family fields for every product.
- Legacy products with no explicit family are served as `blanks` fallback.
- Testing checklist:
- Unit: schema mapper tests for `ProductFamily` defaulting.
- Integration: admin create/update product with each family key.
- E2E: verify catalog/product page still renders old products after migration.
- Rollout plan: Deploy with `FF_DTF_NAV_V1=false` and no UI switch to new templates yet.
- Risks + mitigations: Risk of null family rows for old products; mitigate with migration default + post-migration verification query.

## P0-02 Codify Supabase RLS and Public Views in Versioned SQL
- Scope: Move policy and public-view definitions into repo-managed SQL so environments are reproducible.
- Files to touch: `backend/prisma/migrations/20260215093000_phase0_rls_views/migration.sql` (NEW), `backend/scripts/sql/verify_phase0_rls.sql` (NEW), `backend/scripts/sql/verify_public_views.sql` (NEW), `apps/store/src/data/products.api.ts`, `apps/store/src/data/categories.api.ts`.
- Database changes: Enable RLS on `products`, `product_variants`, `categories`, `orders`, `customization_assets` (or replacement upload table when introduced), and new cart tables when created; create/replace `v_products_public_list` and `v_product_variants_public` to expose only published products and include family metadata; add policy-aware grants on views.
- Backend changes: None required for endpoint behavior; add startup warning log if view shape mismatch is detected.
- Frontend changes: Align view column mapping and remove fallback ambiguity between snake_case/camelCase where possible.
- Acceptance criteria:
- SQL can be applied from clean database and from current database without manual edits.
- Anonymous client can read only published catalog via public views.
- Anonymous client cannot write catalog/order/upload tables.
- Testing checklist:
- Unit: N/A.
- Integration: `verify_phase0_rls.sql` and `verify_public_views.sql` pass in CI DB.
- E2E: store catalog loads with Supabase anon key after policy changes.
- Rollout plan: Apply in staging first; run read-path smoke tests; then prod migration window.
- Risks + mitigations: Risk of accidental catalog lockout; mitigate with staged rollout and pre-validated SQL assertions.

## P0-03 Introduce DB Cart Foundation (Guest + Auth Identity)
- Scope: Create persistent carts so localStorage is not the source of truth and future upload/builder flows can survive device/session changes.
- Files to touch: `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260215100000_phase0_cart_foundation/migration.sql` (NEW), `backend/src/routes/cart.ts` (NEW), `backend/src/app.ts`, `apps/store/src/context/CartContext.tsx`, `apps/store/src/context/AuthContext.tsx`, `apps/store/src/lib/cartId.ts` (NEW).
- Database changes: Create `carts` and `cart_items` tables with `user_id nullable`, `guest_cart_id`, `status`, `option_payload jsonb`; add indexes on `(user_id,status)`, `(guest_cart_id,status)`, `(cart_id,updated_at)`; add RLS owner policies keyed by `auth.uid()` or guest token mapping table.
- Backend changes: Add `/api/cart` read/upsert/remove/merge endpoints; merge guest cart to auth cart on login callback endpoint.
- Frontend changes: Keep local cache for optimistic UX but sync reads/writes to `/api/cart`; persist `guest_cart_id` in cookie/localStorage.
- Acceptance criteria:
- Guest cart survives browser refresh.
- Login merges guest and user cart with deterministic duplicate handling.
- Existing checkout still works with synchronized cart state.
- Testing checklist:
- Unit: merge rule tests (same variant/options merge, upload-linked rows remain distinct).
- Integration: `/api/cart/merge` authenticated flow.
- E2E: add item as guest, login, verify item still present.
- Rollout plan: Dual-write localStorage + DB in first release; switch to DB-primary after telemetry confirms parity.
- Risks + mitigations: Risk of cart duplication during merge; mitigate with item hash key + idempotent merge endpoint.

## P0-04 Harden Cloudinary Signature Boundaries for Customer Uploads
- Scope: Replace multipart-through-backend upload dependency with secure direct signed upload contract for customer artwork.
- Files to touch: `backend/src/lib/cloudinary.ts`, `backend/src/lib/env.ts`, `backend/src/routes/uploads.ts` (NEW), `backend/src/app.ts`, `apps/store/src/components/customize/DesignUploader.tsx`, `apps/store/src/pages/CustomizePage.tsx`, `apps/store/src/lib/cloudinaryUpload.ts` (NEW).
- Database changes: Add lightweight `upload_intents` table or `customization_assets.upload_source` field to audit signature issuance; index by `user_id, created_at`.
- Backend changes: Add authenticated `POST /api/uploads/sign` and `POST /api/uploads/complete`; enforce TTL, MIME allowlist, max bytes, folder scope (`uploads/{userOrGuest}/{family}`), and one-time intent id.
- Frontend changes: Upload directly to Cloudinary API using signed fields; call completion endpoint to persist authoritative metadata.
- Acceptance criteria:
- No Cloudinary secret appears in browser bundles/network payload.
- Expired or reused signatures are rejected.
- Uploaded asset row is owned by caller identity and folder-scoped correctly.
- Testing checklist:
- Unit: signature payload validator and TTL checks.
- Integration: reject wrong MIME, reject wrong folder, accept valid upload completion.
- E2E: customization upload succeeds and asset appears in quote/add-to-cart flow.
- Rollout plan: keep old `/api/customization/upload-design` endpoint behind fallback flag for one release.
- Risks + mitigations: Risk of broken uploads in older clients; mitigate with temporary backward compatibility endpoint and feature flag.

## P0-05 Add Observability Baseline for DTF Flows
- Scope: Standardize structured logs, request correlation ids, and Sentry context for upload/cart/order/customization endpoints.
- Files to touch: `backend/src/app.ts`, `backend/src/lib/logger.ts`, `backend/src/lib/sentry.ts`, `backend/src/routes/orders.ts`, `backend/src/routes/customization.ts`, `backend/src/routes/cart.ts` (NEW), `apps/store/src/lib/logger.ts`, `apps/store/src/lib/sentry.ts`.
- Database changes: None.
- Backend changes: Ensure `X-Request-Id` on every response; include request id and user id (hashed) in logs; add business events (`quote_requested`, `upload_validated`, `order_created`).
- Frontend changes: Propagate request id to client error reports; include product family and flow step in Sentry breadcrumbs.
- Acceptance criteria:
- Every error log contains request id and route.
- Sentry issues include `product_family` tag for DTF pages.
- Can trace one checkout from upload to order creation in logs.
- Testing checklist:
- Unit: logger formatter tests.
- Integration: request id header exists on API responses.
- E2E: forced error in upload flow appears in Sentry with breadcrumb trail.
- Rollout plan: low-risk, can ship dark; verify in staging before enabling alert routes.
- Risks + mitigations: Risk of PII leakage in logs; mitigate with redaction helpers and payload allowlist logging.

## P0-06 Update Deployment/Env Contracts for Cloudflare Pages + Railway
- Scope: Make new phase flags and upload constraints explicit in env templates and deployment docs.
- Files to touch: `backend/.env.example`, `apps/store/.env.example`, `apps/admin/.env.example`, `DeployIntoInternet.md`, `backend/RAILWAY_DEPLOYMENT.md`, `apps/store/src/lib/env.ts`, `apps/admin/src/lib/env.ts`, `backend/src/lib/env.ts`.
- Database changes: None.
- Backend changes: Add strict validation for new env vars (`CLOUDINARY_SIGNATURE_TTL_SEC`, `UPLOAD_MAX_MB`, `UPLOAD_ALLOWED_MIME`, feature flags).
- Frontend changes: Add typed env accessors for new flags and flow toggles.
- Acceptance criteria:
- Fresh environment boot fails fast with clear message if required vars are missing.
- Cloudflare Pages and Railway docs list exactly required vars for current release.
- No secret variable is marked as client-side `VITE_`.
- Testing checklist:
- Unit: env validator tests for required/optional values.
- Integration: startup fails when required upload vars are absent.
- E2E: smoke deploy in staging with flags off.
- Rollout plan: docs + env validation first, feature rollout later.
- Risks + mitigations: Risk of production boot failure due missing vars; mitigate with pre-deploy env checklist and staging parity.

## P0-07 Add Policy and Contract Test Coverage
- Scope: Add missing automated tests for DB policy assumptions and new API contracts.
- Files to touch: `backend/src/tests/rls-policy.test.ts` (NEW), `backend/src/tests/public-views.test.ts` (NEW), `backend/src/tests/upload-signature.test.ts` (NEW), `backend/src/tests/cart.test.ts` (NEW), `backend/src/tests/setup.ts`, `apps/store/tests/e2e/cart-merge.spec.ts` (NEW).
- Database changes: Seed fixtures for cart/view/policy tests; no schema change.
- Backend changes: Add test helpers to issue anon/user/admin tokens and run policy assertions.
- Frontend changes: Add e2e spec for guest-to-auth cart merge.
- Acceptance criteria:
- CI fails if public views leak unpublished products.
- CI fails if anon can write protected tables.
- CI passes new cart merge and upload signature contract suites.
- Testing checklist:
- Unit: helper utilities for JWT fixtures.
- Integration: policy + contract tests in backend suite.
- E2E: cart merge flow in store suite.
- Rollout plan: merge before Phase 1 feature work to prevent regressions.
- Risks + mitigations: Risk of brittle policy tests; mitigate with seed factories and deterministic fixtures.

## P0-08 Ship DTF Information Architecture Skeleton Behind Flags
- Scope: Create route skeleton for start-order/collections/info pages and DTF nav structure without changing existing generic pages for all users.
- Files to touch: `apps/store/src/App.tsx`, `apps/store/src/components/layout/Header.tsx`, `apps/store/src/pages/StartOrderPage.tsx` (NEW), `apps/store/src/pages/CollectionPage.tsx` (NEW), `apps/store/src/pages/InfoPage.tsx` (NEW), `apps/store/src/lib/featureFlags.ts` (NEW), `backend/src/routes/collections.ts` (NEW), `backend/src/app.ts`.
- Database changes: None in this ticket.
- Backend changes: Add minimal read endpoints for collection slug lookup and page metadata fallback.
- Frontend changes: Add new routes and nav config from audit patterns (DTF, UV, Blanks, FAQ/Support) using generic microcopy.
- Acceptance criteria:
- Flag-off users see current experience unchanged.
- Flag-on users can navigate to `/start-order` and `/collections/:slug`.
- New routes render without runtime errors on mobile and desktop.
- Testing checklist:
- Unit: feature flag gate tests for route selection.
- Integration: collection endpoint returns expected shape.
- E2E: nav click path home -> start-order -> collection.
- Rollout plan: enable to internal admins first, then staged percentage rollout.
- Risks + mitigations: Risk of duplicate nav paths and SEO conflicts; mitigate with canonical tags and single route ownership.
