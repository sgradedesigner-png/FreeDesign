# Phase 2 Tickets: Upload-Heavy Flows (Gang Sheet + UV + Async Validation)

## Phase Objective
Phase 2 adds robust upload-first commerce flows for DTF and UV products. It introduces a secure upload lifecycle (sign, upload, validate, moderate, attach to cart/order), implements gang-sheet upload journeys, and hardens error handling and status visibility for customer and ops teams.

## P2-01 Add Upload Lifecycle Schema (Assets, Links, Jobs)
- Scope: Normalize upload metadata and lifecycle state so uploads are first-class entities connected to cart and order lines.
- Files to touch: `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260215143000_phase2_upload_lifecycle/migration.sql` (NEW), `backend/src/services/asset.service.ts`, `backend/src/routes/orders.ts`.
- Database changes: Create `upload_assets`, `cart_item_uploads`, `order_item_uploads`, `upload_validation_jobs`, `upload_validation_events`; add enums for `validation_status` and `moderation_status`; add indexes `(owner_id, created_at)`, `(validation_status, created_at)`, `(order_item_id)`; add owner/admin RLS policies.
- Backend changes: Update asset service to persist into new tables while retaining read compatibility with `customization_assets` during migration.
- Frontend changes: None in this ticket.
- Acceptance criteria:
- Upload asset rows can exist before checkout and link later to cart/order items.
- Validation job rows are created for each newly completed upload.
- Query by order item returns attached upload assets.
- Testing checklist:
- Unit: upload status transition guard tests.
- Integration: create asset -> create job -> link to cart item path.
- E2E: N/A in this ticket.
- Rollout plan: dual-write from old asset path for one release and backfill legacy assets where possible.
- Risks + mitigations: Risk of schema complexity; mitigate with strict migration docs and compatibility views.

## P2-02 Implement Signed Upload + Completion APIs for Customer Flows
- Scope: Formalize upload handshake and completion contract for DTF and UV flows.
- Files to touch: `backend/src/routes/uploads.ts`, `backend/src/lib/cloudinary.ts`, `backend/src/lib/env.ts`, `backend/src/app.ts`, `apps/store/src/lib/cloudinaryUpload.ts`, `apps/store/src/components/customize/DesignUploader.tsx`, `apps/store/src/components/customize/UploadRequirementsNotice.tsx` (NEW).
- Database changes: None beyond P2-01 tables.
- Backend changes: Add `POST /api/uploads/sign` and `POST /api/uploads/complete`; require family context (`gang_upload`, `uv_gang_upload`, `by_size`, `uv_by_size`) and enforce profile-based constraints.
- Frontend changes: Replace direct form upload fallback with signed flow utility used by all upload-capable strategies.
- Acceptance criteria:
- Uploads complete without exposing backend secrets.
- Completion endpoint rejects mismatched family/profile or unsupported file type.
- UI displays clear success/failure state with retry option.
- Testing checklist:
- Unit: upload request payload validators.
- Integration: sign + complete happy path and rejection paths.
- E2E: upload valid file from product page and observe status.
- Rollout plan: enable under `VITE_FF_UPLOAD_ASYNC_VALIDATION_V1` after staging validation.
- Risks + mitigations: Risk of Cloudinary API shape mismatch; mitigate with contract tests against mocked Cloudinary responses.

## P2-03 Add Async Upload Validation Worker and Retry/Dead-Letter Handling
- Scope: Validate uploaded files asynchronously and expose deterministic statuses/messages.
- Files to touch: `backend/src/workers/upload-validator.worker.ts` (NEW), `backend/src/services/upload-validation.service.ts` (NEW), `backend/src/services/job-queue.service.ts` (NEW), `backend/src/app.ts`, `backend/src/lib/env.ts`, `backend/package.json`.
- Database changes: Add retry counters and `next_run_at` fields to `upload_validation_jobs`; add dead-letter status index `(status, next_run_at)`.
- Backend changes: Worker checks MIME, dimensions, DPI heuristics, and family-specific constraints; writes `upload_validation_events`; retries with exponential backoff.
- Frontend changes: None in this ticket.
- Acceptance criteria:
- Every completed upload enters `pending_validation` then terminal `passed` or `failed`.
- Failed validations include machine code + user-readable message.
- Jobs exceeding retry budget move to dead-letter state.
- Testing checklist:
- Unit: validator rule tests by family profile.
- Integration: queue processing and retry behavior.
- E2E: N/A in this ticket.
- Rollout plan: run worker in Railway as separate process; start low concurrency.
- Risks + mitigations: Risk of worker overload; mitigate with queue backpressure and max concurrency env caps.

## P2-04 Implement DTF Gang Sheet Upload Strategy
- Scope: Deliver end-to-end gang-sheet upload flow with fixed width/length variants and upload-required checkout guard.
- Files to touch: `apps/store/src/features/product-family/strategies/GangUploadStrategy.tsx` (NEW), `apps/store/src/components/customize/GangSheetLengthSelector.tsx` (NEW), `apps/store/src/components/customize/UploadStatusChip.tsx` (NEW), `apps/store/src/pages/ProductPage.tsx`, `apps/store/src/context/CartContext.tsx`, `backend/src/routes/products.ts`, `backend/src/routes/cart.ts`.
- Database changes: Add `upload_profiles` seed rows for DTF gang sheet constraints (accepted formats, min DPI, max dimensions).
- Backend changes: Expose upload requirement summary on product payload; enforce that gang-upload items added to cart include at least one validated upload reference.
- Frontend changes: Add length selector, upload panel, and validation-status gating for add-to-cart.
- Acceptance criteria:
- User cannot add gang-upload product without required upload reference.
- Length variant drives price and cart metadata correctly.
- Upload status chips update from pending to passed/failed without page reload.
- Testing checklist:
- Unit: add-to-cart guard logic for required uploads.
- Integration: cart endpoint validation for gang-upload family.
- E2E: start-order -> gang-upload product -> upload -> add to cart.
- Rollout plan: initially enable for one DTF gang-sheet SKU family, then expand.
- Risks + mitigations: Risk of user drop-off from strict validation; mitigate with clear remediation guidance and optional save-for-later.

## P2-05 Implement UV By-Size and UV Gang-Sheet Upload Strategies
- Scope: Extend strategy catalog for UV flows with explicit hard-surface suitability messaging and UV-specific variant sets.
- Files to touch: `apps/store/src/features/product-family/strategies/UvBySizeStrategy.tsx` (NEW), `apps/store/src/features/product-family/strategies/UvGangUploadStrategy.tsx` (NEW), `apps/store/src/features/product-family/resolveStrategy.ts`, `apps/store/src/components/customize/UvUseDisclaimer.tsx` (NEW), `backend/src/routes/products.ts`, `apps/admin/src/pages/ProductFormPage.tsx`.
- Database changes: Add `products.usage_disclaimer_type` or `upload_profiles.surface_constraints` for UV families; add index on `product_family` if not yet present.
- Backend changes: Return UV disclaimer metadata and enforce UV profile validation constraints.
- Frontend changes: Render UV-specific disclaimers and option labels while reusing shared upload/price modules.
- Acceptance criteria:
- UV by-size and UV gang-upload products render family-specific controls.
- UV disclaimer block appears on all UV-family PDPs.
- Cart stores UV family metadata for downstream production routing.
- Testing checklist:
- Unit: strategy resolver coverage for `uv_*` families.
- Integration: product payload includes disclaimer metadata.
- E2E: UV by-size and UV gang-upload add-to-cart flows.
- Rollout plan: release UV strategies after DTF gang-upload stability window.
- Risks + mitigations: Risk of incorrect use-case messaging; mitigate with centralized disclaimer config reviewed by ops.

## P2-06 Cut Over Cart/Order Upload Linking to Normalized Tables
- Scope: Ensure checkout snapshots upload references from cart to order_items and production print packs.
- Files to touch: `backend/src/routes/orders.ts`, `backend/src/services/printpack.service.ts`, `backend/src/routes/admin/production.ts`, `apps/store/src/pages/CheckoutPage.tsx`, `apps/store/src/pages/OrderDetailPage.tsx`, `apps/admin/src/pages/ProductionDashboardPage.tsx`.
- Database changes: Add FK constraints `order_item_uploads.order_item_id -> order_items.id`, `order_item_uploads.upload_asset_id -> upload_assets.id`; add index `(order_item_id, upload_asset_id)`.
- Backend changes: On checkout, resolve cart upload links into `order_item_uploads`; include upload validation state in production payload.
- Frontend changes: Checkout summary and order detail display attached upload counts/statuses.
- Acceptance criteria:
- Orders created from upload flows persist upload links in normalized tables.
- Production print-pack includes design URLs from `order_item_uploads`.
- Historical non-upload orders still render correctly.
- Testing checklist:
- Unit: checkout mapper from cart items to order item uploads.
- Integration: order creation writes `order_items` + `order_item_uploads` atomically.
- E2E: place upload-based order and verify admin production details include files.
- Rollout plan: keep fallback to old customization relation until data parity report passes.
- Risks + mitigations: Risk of orphaned upload links; mitigate with transaction boundaries and FK constraints.

## P2-07 Build Admin Upload Moderation Queue
- Scope: Give ops users an admin queue to review failed/flagged uploads and apply controlled overrides with audit trail.
- Files to touch: `apps/admin/src/App.tsx`, `apps/admin/src/components/layout/Sidebar.tsx`, `apps/admin/src/pages/UploadModerationPage.tsx` (NEW), `apps/admin/src/lib/api.ts`, `backend/src/routes/admin/uploads.ts` (NEW), `backend/src/app.ts`.
- Database changes: Add `upload_moderation_actions` table with actor, action, reason, previous_status, new_status; index `(upload_asset_id, created_at)`.
- Backend changes: Add admin endpoints for queue list/filter, approve/reject/override actions, and audit retrieval.
- Frontend changes: Add filters by status/family/date, detail drawer, and override confirmation modal.
- Acceptance criteria:
- Admin can list pending/failed uploads and apply approved actions.
- Every moderation action writes immutable audit row.
- Customer-facing upload status updates after moderation action.
- Testing checklist:
- Unit: moderation action validator.
- Integration: admin moderation endpoints with auth guard.
- E2E: admin approves failed upload and customer sees updated status.
- Rollout plan: restrict route to admin role and internal users first.
- Risks + mitigations: Risk of unsafe overrides; mitigate with reason-required workflow and audit export.

## P2-08 Add Upload Journey Test Pack and Rollout Gate
- Scope: Establish release gate for upload-heavy features before broad enablement.
- Files to touch: `apps/store/tests/e2e/dtf-gang-upload.spec.ts` (NEW), `apps/store/tests/e2e/uv-upload.spec.ts` (NEW), `backend/src/tests/upload-validation-worker.test.ts` (NEW), `backend/src/tests/admin-upload-moderation.test.ts` (NEW), `docs/DTF_TICKETS_PHASE_2.md`.
- Database changes: Test fixtures for upload statuses and moderation actions.
- Backend changes: Add test-only hooks to enqueue validation jobs deterministically.
- Frontend changes: Add stable test ids to upload widgets and status chips.
- Acceptance criteria:
- End-to-end upload journeys pass in CI with deterministic status transitions.
- Backend worker/moderation suites pass without flaky retries.
- Feature flag enablement checklist completed and signed off.
- Testing checklist:
- Unit: validator and moderation utility tests.
- Integration: worker queue + admin endpoints.
- E2E: DTF and UV upload flows including error-state UX.
- Rollout plan: enable `FF_UPLOAD_ASYNC_VALIDATION_V1` for internal users, then staged public rollout.
- Risks + mitigations: Risk of CI instability due async timing; mitigate with mocked queue clocks and polling helpers.
