# Phase 3 Tickets: Builder MVP + Admin Ops + Scale Hardening

## Phase Objective
Phase 3 delivers a resumable gang-sheet builder MVP, production operations tooling, and production hardening. It completes the public-site pattern set by adding builder flow parity and ensures the platform is reliable at scale on Cloudflare Pages + Railway.

## P3-01 Add Gang Sheet Builder Data Model
- Scope: Create persistence layer for builder projects, canvas items, and generated previews.
- Files to touch: `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260215170000_phase3_builder_models/migration.sql` (NEW), `backend/src/services/builder.service.ts` (NEW).
- Database changes: Create `gang_sheet_projects`, `gang_sheet_project_items`, `gang_sheet_project_versions`; add indexes `(owner_id, updated_at)`, `(project_id, z_index)`, `(status, updated_at)`; add owner/admin RLS policies.
- Backend changes: Add service methods for project create/read/update/version snapshot.
- Frontend changes: None in this ticket.
- Acceptance criteria:
- Project can be created and updated independently of cart/order.
- Project item ordering is deterministic by `z_index`.
- Version snapshots allow rollback to last saved state.
- Testing checklist:
- Unit: builder model validators and serialization tests.
- Integration: create/update/list project DB paths.
- E2E: N/A in this ticket.
- Rollout plan: dark launch with no public route exposure.
- Risks + mitigations: Risk of rapid table growth; mitigate with retention policy for draft versions.

## P3-02 Implement Builder API Surface and Worker Integration
- Scope: Expose authenticated builder endpoints and queue preview generation jobs.
- Files to touch: `backend/src/routes/builder.ts` (NEW), `backend/src/services/builder.service.ts`, `backend/src/services/builder-preview.service.ts` (NEW), `backend/src/workers/builder-preview.worker.ts` (NEW), `backend/src/app.ts`, `backend/src/lib/env.ts`.
- Database changes: Add `builder_preview_jobs` and `builder_preview_assets` tables with indexes `(project_id, status)`.
- Backend changes: Add endpoints `POST /api/builder/projects`, `GET /api/builder/projects/:id`, `PUT /api/builder/projects/:id`, `POST /api/builder/projects/:id/render-preview`.
- Frontend changes: None in this ticket.
- Acceptance criteria:
- Builder APIs enforce ownership and return stable project payload shape.
- Preview render requests enqueue jobs and expose status polling.
- Invalid project geometry requests are rejected with clear errors.
- Testing checklist:
- Unit: project payload zod validators.
- Integration: API auth + ownership checks + job enqueue behavior.
- E2E: N/A in this ticket.
- Rollout plan: expose only to internal users via feature flag and allowlist.
- Risks + mitigations: Risk of expensive preview generation; mitigate with job throttling and per-user limits.

## P3-03 Build Storefront Builder MVP UI
- Scope: Implement interactive builder page with autosave and project resume from product flow.
- Files to touch: `apps/store/src/pages/GangSheetBuilderPage.tsx` (NEW), `apps/store/src/components/builder/BuilderCanvas.tsx` (NEW), `apps/store/src/components/builder/BuilderToolbar.tsx` (NEW), `apps/store/src/components/builder/BuilderAssetPanel.tsx` (NEW), `apps/store/src/components/builder/BuilderFooterBar.tsx` (NEW), `apps/store/src/App.tsx`, `apps/store/src/lib/featureFlags.ts`.
- Database changes: None beyond P3-01/P3-02 schema.
- Backend changes: None beyond builder APIs.
- Frontend changes: Add route `/builder/:productSlug`; autosave debounce, unsaved-state guards, and resume prompt.
- Acceptance criteria:
- User can open builder from eligible product and place/upload assets on canvas.
- Autosave persists project changes and restores on reload.
- Builder shows preview status and validation warnings.
- Testing checklist:
- Unit: canvas transform and snapping helpers.
- Integration: builder API client hooks.
- E2E: start-order -> builder product -> create/save/resume project.
- Rollout plan: enable `VITE_FF_BUILDER_MVP_V1` for limited traffic after ops signoff.
- Risks + mitigations: Risk of browser performance issues on large canvases; mitigate with item count limits and virtualization.

## P3-04 Implement Builder-to-Cart and Builder-to-Order Handoff
- Scope: Attach saved builder projects to cart items and order items with immutable snapshot references.
- Files to touch: `apps/store/src/context/CartContext.tsx`, `apps/store/src/pages/GangSheetBuilderPage.tsx`, `apps/store/src/pages/CheckoutPage.tsx`, `backend/src/routes/cart.ts`, `backend/src/routes/orders.ts`, `backend/src/services/printpack.service.ts`.
- Database changes: Add `cart_items.builder_project_id` and `order_items.builder_project_id` FKs; add index `(builder_project_id)`; add constraint preventing project attach across different owners.
- Backend changes: Validate project ownership during cart add and checkout; freeze project version id on order creation.
- Frontend changes: Add "Add Builder Project to Cart" action and order summary rendering of builder references.
- Acceptance criteria:
- Builder project can be attached to cart and persists through checkout.
- Order stores immutable project version reference for production.
- Production print pack can retrieve builder-generated assets.
- Testing checklist:
- Unit: ownership checks for project references.
- Integration: cart/order endpoints reject invalid project ids.
- E2E: builder create -> cart -> checkout -> admin print pack includes builder asset.
- Rollout plan: enable for one builder SKU first, then all builder families.
- Risks + mitigations: Risk of stale project edits after checkout; mitigate by storing version id, not mutable draft id.

## P3-05 Extend Admin Operations (SLA Board, Reprint, Hold/Release)
- Scope: Expand admin production tools from status updates to SLA-driven operations and exception handling.
- Files to touch: `apps/admin/src/pages/ProductionDashboardPage.tsx`, `apps/admin/src/pages/ReprintQueuePage.tsx` (NEW), `apps/admin/src/App.tsx`, `apps/admin/src/components/layout/Sidebar.tsx`, `backend/src/routes/admin/production.ts`, `backend/src/routes/admin/reprints.ts` (NEW), `backend/src/services/production.service.ts`.
- Database changes: Create `reprint_requests`, `order_sla_events`, `order_holds`; add indexes `(sla_due_at, status)`, `(order_id, created_at)`; add admin-only policies.
- Backend changes: Add endpoints for hold/release, SLA assignment, and reprint lifecycle state transitions.
- Frontend changes: Add SLA filters, queue aging indicators, and reprint action workflows.
- Acceptance criteria:
- Ops can prioritize by SLA due windows.
- Reprint request lifecycle is trackable without DB console access.
- Hold/release actions are audited and visible in order timeline.
- Testing checklist:
- Unit: SLA status derivation logic.
- Integration: reprint/hold admin endpoints with role guard.
- E2E: create reprint from order and move through queue states.
- Rollout plan: admin-only release with training and runbook updates.
- Risks + mitigations: Risk of invalid status transitions; mitigate with transition guards and audit logs.

## P3-06 Add CMS-Lite for Pages, FAQ, and Blog Templates
- Scope: Implement managed content for informational and blog templates seen in audit (`/pages/*`, `/blogs/*`) with publish controls.
- Files to touch: `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260215183000_phase3_cms_content/migration.sql` (NEW), `backend/src/routes/pages.ts` (NEW), `backend/src/routes/blog.ts` (NEW), `backend/src/routes/admin/content.ts` (NEW), `backend/src/app.ts`, `apps/admin/src/pages/ContentPagesPage.tsx` (NEW), `apps/admin/src/pages/BlogPostsPage.tsx` (NEW), `apps/store/src/pages/InfoPage.tsx`, `apps/store/src/pages/BlogIndexPage.tsx` (NEW), `apps/store/src/pages/BlogPostPage.tsx` (NEW), `apps/store/src/App.tsx`.
- Database changes: Create `cms_pages`, `faq_items`, `blog_posts`, `blog_categories`; add indexes `(slug, is_published)`, `(published_at desc)`; add public-read published policies and admin-write policies.
- Backend changes: Add public content routes and admin CRUD/moderation routes.
- Frontend changes: Add page/blog template renderers with reusable accordion/card components and internal CTA slots.
- Acceptance criteria:
- Admin can publish/unpublish pages and blog posts.
- Public routes render only published content.
- FAQ accordion and blog list/post templates are reusable and responsive.
- Testing checklist:
- Unit: content slug validation and markdown/html sanitization.
- Integration: admin content CRUD and public publish filtering.
- E2E: publish page/blog in admin and verify storefront route.
- Rollout plan: seed initial FAQ/how-to content from internal copy deck before enabling nav links.
- Risks + mitigations: Risk of unsafe HTML; mitigate with sanitization pipeline and allowlist.

## P3-07 Performance and Abuse Hardening for Scale
- Scope: Tune read paths, caching, and abuse controls for upload and builder endpoints.
- Files to touch: `backend/src/routes/products.ts`, `backend/src/routes/collections.ts`, `backend/src/routes/uploads.ts`, `backend/src/routes/builder.ts`, `backend/src/app.ts`, `backend/src/lib/cache.ts`, `apps/store/src/data/products.api.ts`, `apps/store/src/data/collections.api.ts`.
- Database changes: Add covering indexes for hot catalog and order ops queries; add partial indexes for pending validation jobs and SLA queues.
- Backend changes: Add cache headers for catalog endpoints, stricter rate limits for upload/builder endpoints, optional Turnstile verification for anonymous-heavy actions.
- Frontend changes: Add stale-while-revalidate behavior and request dedupe for collection/product queries.
- Acceptance criteria:
- Catalog read p95 API latency meets target under load test.
- Upload/builder abuse requests are rate-limited and logged.
- No functional regressions in checkout/order flow under cache-enabled mode.
- Testing checklist:
- Unit: cache key generation tests.
- Integration: rate-limit responses and cache-hit behavior.
- E2E: smoke journeys with cache enabled.
- Rollout plan: enable cache in staging, then prod with monitoring and rollback toggle.
- Risks + mitigations: Risk of stale pricing data in cache; mitigate with short TTL and targeted invalidation on admin updates.

## P3-08 SLO Dashboarding, Alerts, and Final Production Cutover
- Scope: Finalize runbooks, dashboards, and release checklist for full feature flag enablement.
- Files to touch: `backend/load-tests/dtf-read-write-benchmark.js` (NEW), `backend/docs/DTF_RUNBOOK.md` (NEW), `backend/docs/DTF_SLOS.md` (NEW), `apps/store/README.md`, `apps/admin/README.md`, `docs/DTF_IMPLEMENTATION_PLAN.md`.
- Database changes: None.
- Backend changes: Emit metrics for upload validation duration, builder render latency, checkout failure rate, and production queue aging.
- Frontend changes: Add client-side telemetry events for key funnel steps (start-order click, upload complete, add-to-cart success, checkout start).
- Acceptance criteria:
- SLO dashboard tracks agreed KPIs for catalog, upload, checkout, and builder flows.
- Alert routing exists for sustained error-rate/latency breaches.
- Full flag cutover checklist is signed off by engineering and ops.
- Testing checklist:
- Unit: metric payload schema tests.
- Integration: synthetic monitors for health/readiness and key public routes.
- E2E: final smoke suite with all flags enabled.
- Rollout plan: progressive enablement to 100 percent traffic after two stable release windows.
- Risks + mitigations: Risk of noisy alerts; mitigate with tuned thresholds and burn-rate based alerting.
