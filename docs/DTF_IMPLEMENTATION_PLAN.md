# DTF Implementation Plan (Phase 0-3)

## Scope
This plan ports public-site interaction patterns captured in `dtfsheet_audit/` into the existing monorepo without copying source copy text verbatim. It is implementation-first and PR-sized.

Source artifacts used:
- `dtfsheet_audit/implementation-blueprint.md`
- `dtfsheet_audit/templates.md`
- `dtfsheet_audit/flows.md`
- `dtfsheet_audit/routes.md`
- `dtfsheet_audit/data-model.mmd`
- `dtfsheet_audit/network.md`
- `dtfsheet_audit/product_models.json`
- `dtfsheet_audit/network_summary.json`
- `dtfsheet_audit/sitemap_inventory.json`

## Repo Reality Check

### Current architecture detected
- Storefront: `apps/store` (Vite + React + TypeScript + Tailwind, Supabase client + react-query).
- Admin: `apps/admin` (React + TypeScript, already has pricing/production/orders/product admin pages).
- Backend: `backend` (Fastify + Prisma + Supabase token validation + Cloudinary + QPay + Sentry).
- Hosting model already documented: Cloudflare Pages (store/admin), Railway (backend).

### Existing capabilities already in code
- Auth and identity: Supabase auth wired in store/admin/backend (`apps/store/src/context/AuthContext.tsx`, `apps/admin/src/auth/AuthContext.tsx`, `backend/src/middleware/userGuard.ts`, `backend/src/supabaseauth.ts`).
- Product catalog primitives: categories/products/variants + admin CRUD (`backend/prisma/schema.prisma`, `backend/src/routes/admin/products.ts`, `backend/src/routes/products.ts`).
- DTF customization foundation: print areas, size tiers, pricing rules, design upload, mockup preview, production statuses (`backend/src/routes/customization.ts`, `backend/src/services/pricing.service.ts`, `backend/src/services/printpack.service.ts`, `apps/store/src/pages/CustomizePage.tsx`, `apps/admin/src/pages/PricingRulesPage.tsx`, `apps/admin/src/pages/ProductionDashboardPage.tsx`).
- Checkout/order flow exists with QPay and user orders (`apps/store/src/pages/CheckoutPage.tsx`, `backend/src/routes/orders.ts`).
- Cloudinary integration exists server-side (`backend/src/lib/cloudinary.ts`).

### Gaps vs blueprint and dtfsheet_audit
- Missing DTF-specific IA: no `/collections/:slug`, no `/pages/start-order`, no strategy-driven product templates for by-size/gang-upload/gang-builder/uv/blanks.
- Store data access is mixed (Supabase views for catalog pages, backend fetch for home trends/new arrivals).
- Cart is localStorage only (`apps/store/src/context/CartContext.tsx`), no DB cart persistence, no guest/auth merge.
- Order items are JSON snapshots on `orders.items`; no normalized `order_items` link model for uploads/projects.
- No gang sheet project/builder persistence model in Prisma.
- No async upload validation queue with deterministic status transitions and moderation.
- RLS/policies are not codified in repo migrations/scripts (only ad-hoc docs/scripts for public views).
- Admin upload client still behaves like R2 PUT while backend presigned endpoint now returns Cloudinary signature payload (`apps/admin/src/components/ImageUpload.tsx` vs `backend/src/routes/admin/upload-presigned.ts`).

### Constraints to honor in implementation
- Keep existing `orders` + QPay flow stable while introducing normalized `order_items` in parallel (dual write, then cutover).
- Respect existing schema naming mix (`is_published` style in Prisma model fields + quoted DB columns in scripts).
- Preserve existing customization and production dashboards; extend instead of replacing.
- Keep Cloudinary secret server-only; browser uses short-lived signatures only.
- Avoid scraping new external data; use only `dtfsheet_audit/` artifacts.

## Phase Roadmap (0-3)

### Phase 0: Foundation and Safety
Objective: establish schema conventions, feature flags, codified RLS/policies, secure upload boundaries, and observability baselines without breaking current storefront/checkout.

Ticket file: `docs/DTF_TICKETS_PHASE_0.md`

### Phase 1: Core Storefront + By-Size + Blanks
Objective: implement dtf-style information architecture and user journeys for by-size and blanks with reusable product-family strategies and collection templates.

Ticket file: `docs/DTF_TICKETS_PHASE_1.md`

### Phase 2: Upload-Heavy Flows (Gang Sheet + UV)
Objective: add robust upload-first product families (DTF and UV), signed direct uploads, async validation, moderation queue, and order linkage from cart to print ops.

Ticket file: `docs/DTF_TICKETS_PHASE_2.md`

### Phase 3: Builder MVP + Admin Ops + Scale Hardening
Objective: deliver gang sheet builder MVP, operational controls, CMS-like support content tooling, and production-grade performance/security/observability hardening.

Ticket file: `docs/DTF_TICKETS_PHASE_3.md`

## Cross-Cutting Architecture Decisions

### 1) Product Family Strategy Pattern
Implement one product shell with pluggable family strategies.

Proposed family keys:
- `by_size`
- `gang_upload`
- `gang_builder`
- `blanks`
- `uv_by_size`
- `uv_gang_upload`
- `uv_gang_builder`

Frontend contract:
- `apps/store/src/features/product-family/types.ts` (NEW): `ProductFamily`, `ProductFamilyConfig`, `UploadRequirementSummary`.
- `apps/store/src/features/product-family/resolveStrategy.ts` (NEW): maps `product.family` to strategy component.
- `apps/store/src/pages/ProductPage.tsx` (NEW): shared shell + family strategy renderer.

Backend contract:
- Add product family metadata to `products` in Prisma; return through public views and admin/product endpoints.
- Keep variant model intact; family strategy decides option rendering and CTA sequence.

### 2) Cart Persistence: Guest + Auth
Target behavior:
- Guest: cookie-based `guest_cart_id` + DB cart row with `user_id = null`.
- Authenticated: cart keyed by `user_id`; on login, merge guest cart into user cart with deterministic rules.
- LocalStorage becomes UI cache only, DB is source of truth.

Merge rules:
- Same SKU + same option hash + same upload references => quantity merge.
- Different upload references or builder project => separate cart rows.

### 3) Linking Upload Assets Across Cart and Orders
Target model:
- `cart_items` own option selections and references to `upload_assets` and/or `gang_sheet_projects`.
- `order_items` are immutable snapshots created from cart items at checkout.
- `order_item_uploads` preserves all final print files used by production.

Migration approach:
- Dual-write `orders.items` JSON + `order_items` for one phase.
- Cut API reads to `order_items` after parity validation.

### 4) Cloudinary Signed Upload Boundaries
Security boundaries:
- Signatures only from backend (`backend/src/routes/uploads.ts` NEW).
- Signature TTL <= 60 seconds; folder scope includes user/guest namespace and product family.
- Client never receives API secret.
- Upload completion endpoint validates ownership, file type, dimensions, and folder policy before persisting row.

Operational boundaries:
- Separate folders: `uploads/dtf/...`, `uploads/uv/...`, `builder/source/...`, `builder/renders/...`.
- Enforce explicit MIME allowlist and max size per family.

### 5) Supabase RLS Model
Policy intent:
- Public read: catalog and published content views.
- Owner read/write: carts, cart_items, orders, order_items, upload_assets, gang_sheet_projects.
- Admin/service role write: product catalog, order state transitions, moderation/ops tables.

Important implementation detail:
- Because backend uses Prisma service credentials, enforce authorization in backend and DB RLS; do not rely on frontend-only guards.

## Deployment and Environment Mapping (Cloudflare Pages + Railway)

### Store (Cloudflare Pages)
Required env additions:
- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TURNSTILE_SITE_KEY`
- `VITE_FF_DTF_NAV_V1`
- `VITE_FF_CART_DB_V1`
- `VITE_FF_UPLOAD_ASYNC_VALIDATION_V1`
- `VITE_FF_BUILDER_MVP_V1`

### Admin (Cloudflare Pages)
Required env additions:
- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TURNSTILE_SITE_KEY`
- `VITE_FF_DTF_ADMIN_V1`

### Backend (Railway)
Required env additions:
- Existing required vars in `backend/.env.example` stay.
- Add: `CLOUDINARY_SIGNATURE_TTL_SEC`, `UPLOAD_MAX_MB`, `UPLOAD_ALLOWED_MIME`, `FF_DTF_NAV_V1`, `FF_CART_DB_V1`, `FF_UPLOAD_ASYNC_VALIDATION_V1`, `FF_BUILDER_MVP_V1`.
- Keep secrets only in Railway Variables; no secrets in Cloudflare Pages.
- Update `CORS_ORIGIN` to include store/admin production domains.

### Release strategy
- Use feature flags per phase and route-level canary release.
- Deploy backend first with dormant flags, then admin/store UI, then enable flags gradually.

## Next 5 Actions
1. PR-1 (Phase 0): implement product family metadata + feature flags + env validation updates (`P0-01`, `P0-06`).
2. PR-2 (Phase 0): codify RLS/public views in migration SQL + policy tests (`P0-02`, `P0-07`).
3. PR-3 (Phase 0): add secure customer upload signing endpoint and wire `DesignUploader` to signed direct uploads (`P0-04`).
4. PR-4 (Phase 1): ship IA skeleton (`/start-order`, `/collections/:slug`) and mega-menu under flag (`P0-08`, `P1-02`).
5. PR-5 (Phase 1): introduce product family strategy shell and deliver by-size + blanks flows end-to-end (`P1-03`, `P1-04`, `P1-05`).
