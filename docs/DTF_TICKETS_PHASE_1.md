# Phase 1 Tickets: Core Storefront + By-Size + Blanks

## Phase Objective
Phase 1 delivers the primary storefront structure and conversion flow for the audit's highest-volume paths: by-size transfer products and blanks catalog. It introduces strategy-based product rendering, collection browsing, and conversion modules (trust, urgency, reviews) while preserving existing checkout reliability.

## P1-01 Add Collections Data Model and Public Query Endpoints
- Scope: Implement first-class collections to support `/collections/:slug` and merchandising links from start-order and mega-menu.
- Files to touch: `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260215113000_phase1_collections/migration.sql` (NEW), `backend/src/routes/collections.ts`, `backend/src/routes/admin/collections.ts` (NEW), `backend/src/app.ts`, `apps/admin/src/App.tsx`, `apps/admin/src/components/layout/Sidebar.tsx`, `apps/admin/src/pages/CollectionsPage.tsx` (NEW).
- Database changes: Create `collections` and `collection_products`; add indexes `(slug)`, `(is_active, sort_order)`, `(collection_id, product_id)`; add RLS public-read for active collections and admin write policies.
- Backend changes: Add public endpoints `GET /api/collections`, `GET /api/collections/:slug`; add admin CRUD for collections and product assignments.
- Frontend changes: Add admin page to maintain collection metadata and product ordering.
- Acceptance criteria:
- Admin can create/update/archive collections.
- Public API returns collection details with product count and ordered products.
- Collection-product ordering is stable across requests.
- Testing checklist:
- Unit: collection slug normalization utilities.
- Integration: admin collection CRUD + assignment endpoints.
- E2E: create collection in admin and see it on store route.
- Rollout plan: backfill existing category->collection mapping script before enabling collection routes in store.
- Risks + mitigations: Risk of duplicate collection slug collisions; mitigate with unique index and validation.

## P1-02 Build Start-Order Funnel Page and DTF Mega-Menu
- Scope: Implement entry page for flow routing (by-size, gang upload, builder, UV, blanks), matching observed journey entry behavior from audit.
- Files to touch: `apps/store/src/components/layout/Header.tsx`, `apps/store/src/components/layout/MegaMenu.tsx` (NEW), `apps/store/src/pages/StartOrderPage.tsx`, `apps/store/src/App.tsx`, `apps/store/src/lib/navigation.ts` (NEW).
- Database changes: None.
- Backend changes: Optional read endpoint for nav config if server-driven menu is preferred later; no blocker for static config.
- Frontend changes: Add mega-menu groups and `start-order` cards with generic microcopy; include CTA routing to target product families and collections.
- Acceptance criteria:
- Header includes DTF, UV, Blanks, FAQ/Support groups under feature flag.
- `/start-order` page renders all five observed flow entry points.
- Every funnel card navigates to the correct route.
- Testing checklist:
- Unit: nav config schema validation.
- Integration: N/A.
- E2E: home -> start-order -> each route target smoke test.
- Rollout plan: ship under `VITE_FF_DTF_NAV_V1`; gradually enable by environment.
- Risks + mitigations: Risk of route mismatch with unfinished pages; mitigate by routing unfinished links to guarded placeholders.

## P1-03 Introduce ProductPage Strategy Framework
- Scope: Replace monolithic `ProductDetails` behavior with pluggable strategy components keyed by `product_family`.
- Files to touch: `apps/store/src/pages/ProductPage.tsx` (NEW), `apps/store/src/pages/ProductDetails.tsx`, `apps/store/src/features/product-family/types.ts` (NEW), `apps/store/src/features/product-family/resolveStrategy.ts` (NEW), `apps/store/src/features/product-family/strategies/BySizeStrategy.tsx` (NEW), `apps/store/src/features/product-family/strategies/BlanksStrategy.tsx` (NEW), `apps/store/src/App.tsx`.
- Database changes: None.
- Backend changes: Ensure product endpoints always return family metadata and variant option shape needed by strategies.
- Frontend changes: Product shell handles shared layout blocks (gallery, trust row, FAQ slot, reviews slot); strategy handles option controls and CTA labels.
- Acceptance criteria:
- Strategy selection is deterministic from product payload.
- Existing generic products still render through `blanks` strategy fallback.
- Shared blocks appear consistently across strategies.
- Testing checklist:
- Unit: strategy resolver tests for all family keys.
- Integration: product query payload compatibility tests.
- E2E: open one by-size and one blanks product, verify correct controls.
- Rollout plan: route old `ProductDetails` -> new shell behind feature flag.
- Risks + mitigations: Risk of broken PDP rendering due missing fields; mitigate with runtime guards and fallback strategy.

## P1-04 Implement DTF By-Size Flow (Size + Finishing + Quantity Tiers)
- Scope: Deliver full by-size journey from product entry to cart add with finishing option and tiered pricing display.
- Files to touch: `apps/store/src/features/product-family/strategies/BySizeStrategy.tsx`, `apps/store/src/components/product/ProductInfo.tsx`, `apps/store/src/components/product/PricingTierTable.tsx` (NEW), `apps/store/src/context/CartContext.tsx`, `backend/src/routes/products.ts`, `backend/src/routes/pricing-public.ts` (NEW), `backend/src/app.ts`.
- Database changes: Add `variant_price_tiers` table for quantity breaks; index `(variant_id, min_qty)`; RLS public-read.
- Backend changes: Expose read endpoint for tier pricing by variant; include finishing option metadata in product payload.
- Frontend changes: Render size selector, finishing selector (`roll` vs `pre_cut`), quantity selector, dynamic per-unit and subtotal updates.
- Acceptance criteria:
- User can select size + finishing + quantity and add item to cart.
- Pricing reflects quantity tier breaks and finishing surcharge deterministically.
- Cart line item stores selected options in structured payload.
- Testing checklist:
- Unit: pricing calculator for tiers and surcharge.
- Integration: public pricing endpoint with sample variants.
- E2E: by-size flow from PDP to cart with option verification.
- Rollout plan: enable only for products marked `by_size`; keep legacy behavior for others.
- Risks + mitigations: Risk of pricing drift between frontend/backend; mitigate with backend-authored quote endpoint and shared tests.

## P1-05 Implement Blanks Collection and PDP Variant UX
- Scope: Deliver blanks browsing and variant-first purchase journey (size/color variant combinations from collection to cart).
- Files to touch: `apps/store/src/pages/CollectionPage.tsx`, `apps/store/src/components/product/ProductCard.tsx`, `apps/store/src/components/layout/FilterSidebar.tsx`, `apps/store/src/features/product-family/strategies/BlanksStrategy.tsx`, `apps/store/src/data/collections.api.ts` (NEW), `backend/src/routes/collections.ts`, `backend/src/routes/products.ts`.
- Database changes: Add optional `collection_facets` materialized view or query index on `product_variants(sizes, isAvailable, stock)` for filter speed.
- Backend changes: Add faceted collection query with filters `size`, `in_stock`, `sort`.
- Frontend changes: Add collection sort/filter controls and blanks-focused variant display.
- Acceptance criteria:
- User can filter blanks collection and open product detail.
- Variant/size selection is required before add-to-cart.
- Collection filter state persists in query params.
- Testing checklist:
- Unit: filter query-state serializer.
- Integration: collection endpoint filtering behavior.
- E2E: blanks collection -> PDP -> cart add.
- Rollout plan: launch with top 3 blanks collections first, then full migration.
- Risks + mitigations: Risk of slow collection queries; mitigate with indexes and pagination defaults.

## P1-06 Add Shared Conversion Modules (Trust, Reviews, Shipping Promise)
- Scope: Add reusable UI blocks observed across templates without copying source copy text.
- Files to touch: `apps/store/src/components/conversion/TrustBadges.tsx` (NEW), `apps/store/src/components/conversion/ShippingPromiseBar.tsx` (NEW), `apps/store/src/components/conversion/ReviewSummary.tsx` (NEW), `apps/store/src/components/product/CustomerReviews.tsx`, `apps/store/src/pages/HomePage.tsx`, `apps/store/src/pages/ProductPage.tsx` (NEW).
- Database changes: Add `review_summaries` view or extend existing product review aggregate source; index `products(rating, reviews)` if missing.
- Backend changes: Optional endpoint for shipping cutoff config and review aggregates.
- Frontend changes: Inject conversion modules into home, collection, and product templates.
- Acceptance criteria:
- Conversion modules are reusable and configurable by page type.
- Shipping promise bar can be toggled by feature flag.
- Review summary renders even when detailed review list is unavailable.
- Testing checklist:
- Unit: conversion module props and fallback rendering.
- Integration: shipping/review config endpoint (if enabled).
- E2E: verify module visibility on home + PDP.
- Rollout plan: enable modules in read-only mode first; A/B gate urgency module if needed.
- Risks + mitigations: Risk of trust-content inconsistency; mitigate with central config file and legal review.

## P1-07 Introduce Normalized Order Items (Dual Write)
- Scope: Start migration away from `orders.items` JSON by adding normalized `order_items` while preserving existing API response shape.
- Files to touch: `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260215130000_phase1_order_items/migration.sql` (NEW), `backend/src/routes/orders.ts`, `backend/src/routes/admin/orders.ts`, `backend/src/services/printpack.service.ts`, `apps/store/src/pages/CheckoutPage.tsx`, `apps/store/src/pages/OrderDetailPage.tsx`.
- Database changes: Create `order_items` table with `order_id`, `variant_id`, `quantity`, `unit_price`, `selected_options jsonb`; add indexes `(order_id)`, `(variant_id)`, `(created_at)`; add owner/admin RLS policies.
- Backend changes: On order creation, dual-write `orders.items` and `order_items`; on reads, prefer `order_items` if present, fallback to JSON.
- Frontend changes: Update checkout/order detail models to consume normalized shape when available.
- Acceptance criteria:
- New orders create valid `order_items` rows.
- Existing order-detail pages continue to load historical orders.
- Admin order views show consistent totals before and after migration.
- Testing checklist:
- Unit: order total consistency checks between JSON and rows.
- Integration: create order endpoint writes both representations.
- E2E: place order and verify order detail item rendering.
- Rollout plan: keep dual-write for at least one release cycle before JSON deprecation.
- Risks + mitigations: Risk of mismatch between snapshots and rows; mitigate with post-write parity assertion and alerting.

## P1-08 Core Journey Regression Suite and Phase Gate
- Scope: Add journey-level test coverage for Phase 1 before enabling broad rollout.
- Files to touch: `apps/store/tests/e2e/by-size-flow.spec.ts` (NEW), `apps/store/tests/e2e/blanks-flow.spec.ts` (NEW), `apps/store/tests/e2e/start-order-nav.spec.ts` (NEW), `backend/src/tests/order-items-dualwrite.test.ts` (NEW), `backend/src/tests/collections.test.ts` (NEW).
- Database changes: Add test fixtures for collection/product families and order dual-write checks.
- Backend changes: None beyond test harness support.
- Frontend changes: None beyond test selectors/data attributes.
- Acceptance criteria:
- All new e2e flows pass in CI on staging config.
- Backend contract tests for collections and order dual-write pass.
- Phase 1 flag enablement checklist is documented and approved.
- Testing checklist:
- Unit: not primary in this ticket.
- Integration: backend contracts for collection/order item writes.
- E2E: start-order, by-size, blanks journeys.
- Rollout plan: enable `VITE_FF_DTF_NAV_V1` and by-size/blanks strategies for 10 percent traffic, then 50 percent, then 100 percent after error budget check.
- Risks + mitigations: Risk of flaky e2e in CI; mitigate with deterministic fixtures and retry policy only for known network waits.
