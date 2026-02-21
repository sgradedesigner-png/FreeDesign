# BLANKS Customization: Production-Standard Implementation Plan (Admin + Backend + Store)

Date: 2026-02-21
Owner: Product Customization Track
Scope: `apps/admin`, `backend`, `apps/store`

## 1) Executive Summary

This plan aligns your current BLANKS customization flow to a production-standard model where:
- `Print Area` = **where** design can be placed (zone semantics + max cm constraints)
- `Print Size Tier` = **how large** the design is in production/pricing terms (cm tiers)
- `Layout Preset (GhostRect)` = **visual authoring geometry** on each garment view (normalized x/y/w/h)

Your current system is close, but has one key product gap:
- `printAreas` are product-scoped and persisted.
- `sizeTiers` are currently treated globally on storefront, while Step 4 Admin UI implies product-level selection.

Recommended v1 production decision:
- Keep `sizeTiers` global in v1 (no product-level assignment yet).
- Make Step 4 UI explicit about that (avoid misleading per-product selection behavior).

---

## 2) Current Codebase State (Deep Read)

## 2.1 Admin Wizard (authoring)

- Print Configuration step UI + preset authoring:
  - `apps/admin/src/components/product-wizard/steps/Step4_PrintConfig.tsx`
- Wizard submission payload:
  - `apps/admin/src/components/product-wizard/WizardContainer.tsx`
- Wizard schema:
  - `apps/admin/src/hooks/useProductWizard.ts`

Observed behavior:
- Step 4 loads:
  - `GET /api/admin/print-areas`
  - `GET /api/admin/size-tiers`
- Presets saved under product metadata `customizationTemplateV1`.
- `printAreas` saved to product linkage table.
- `sizeTiers` is in form state but **not persisted** in create/update payload or backend schema.

## 2.2 Backend (data + APIs)

- Prisma models:
  - `backend/prisma/schema.prisma`
    - `PrintArea`
    - `ProductPrintArea`
    - `PrintSizeTier`
- Admin product create/update:
  - `backend/src/routes/admin/products.ts`
- Layout template route:
  - `backend/src/routes/admin/layout-template.ts`
- Storefront customization options:
  - `backend/src/routes/customization.ts`
- Pricing:
  - `backend/src/services/pricing.service.ts`
- Mockup preview:
  - `backend/src/services/mockup.service.ts`

Observed behavior:
- Product-level print areas are enforced in quote and preview when configured.
- Size tiers are fetched globally from `print_size_tiers` (active records).
- Layout template (`customizationTemplateV1`) is returned via `/api/customization/options`.

## 2.3 Storefront (runtime engine)

- Main page:
  - `apps/store/src/pages/CustomizePage.tsx`
- Placement engine:
  - `apps/store/src/hooks/usePlacementEngine.ts`
- Preset bar:
  - `apps/store/src/components/customize/PlacementPresetBar.tsx`
- Area/tier selectors:
  - `apps/store/src/components/customize/PlacementSelector.tsx`
  - `apps/store/src/components/customize/SizeTierSelector.tsx`

Observed behavior:
- Template-first behavior exists (`layoutTemplate.presets` + `layoutTemplate.views`).
- Legacy fallback still exists in `usePlacementEngine` (hardcoded overrides + placement loader) when template is absent.
- Quote and mockup depend on selected `printAreaId` and `printSizeTierId`.

---

## 3) Production-Standard Target Model

## 3.1 Canonical contracts

1. Geometry source of truth:
- Persist only normalized image-space rectangles (`rectNorm: x,y,w,h in [0..1]`) in presets.
- Pixel coordinates are derived at render time only.

2. Print semantics:
- Every preset should link to one print area (`printAreaId`) for business consistency.
- Size tier remains user-selectable pricing/production dimension.

3. Runtime determinism:
- Storefront uses template views/presets as primary.
- Legacy hardcoded fallback only for products without template (migration window).

## 3.2 UX semantics

- Product apparel size (S/M/L/XL) != Print size tier (e.g., 8x8cm, 15x20cm).
- This distinction must be explicit in Admin labels/help text and Storefront copy.

---

## 4) Gaps and Risks (Current)

1. Step 4 `Size Tiers` UI implies product-level assignment, but data is global runtime.
2. Missing master-data CRUD for `print_areas` and `print_size_tiers` in Admin.
3. Some legacy fallback logic can produce mapping drift perception if templates are missing/incomplete.
4. Empty-state UX in Step 4 does not provide actionable next step when master data is missing.

---

## 5) Recommended Implementation Phases

## Phase A — Master Data Management (Admin)

Goal: make `Print Areas` and `Size Tiers` manageable from Admin, not DB-only.

Deliverables:
- New Admin pages:
  - `/print-areas` CRUD
  - `/size-tiers` CRUD
- Sidebar links (likely under Pricing/Settings group).
- Validation:
  - unique `name`
  - positive max cm / tier cm
  - sortable order
  - activate/deactivate

Backend:
- Add POST/PUT/DELETE for:
  - `/api/admin/print-areas`
  - `/api/admin/size-tiers`
- Keep existing GET routes.

Impact:
- Step 4 empty states disappear once configured.
- Non-engineering operators can own master setup.

## Phase B — Clarify Step 4 Product Semantics

Goal: remove misleading controls and align UI with actual persistence.

Recommended v1:
- Keep `Print Areas` selection in Step 4 (product-level persisted).
- Remove/disable product-level `Size Tiers` selection in Step 4 until backend supports product-level tier linking.
- Show note: "Size tiers are global and configured in Size Tier settings."

Optional v2:
- Introduce `product_size_tiers` link table and per-product tier filtering.

## Phase C — Preset/Area Integrity Rules

Goal: prevent authoring mismatch.

Rules:
- For BLANKS products with templates, each preset must have:
  - non-empty key
  - valid rectNorm
  - linked `printAreaId` (recommended as required)
- Default preset per view: max one default.

API validation:
- Enforce `printAreaId` existence and active status on save.

## Phase D — Storefront Template-Driven Completion

Goal: minimize drift and implicit fallback behavior.

Changes:
- Keep template-first rendering (already in place).
- Restrict legacy fallback behind explicit conditions/feature flag for non-migrated products only.
- Add debug telemetry when fallback is used (to identify un-migrated products).

## Phase E — Geometry Parity/Drift Test Suite

Goal: guarantee admin-authored rect appears same on storefront.

Automated checks:
- save -> reload parity
- responsive resize parity
- viewport change parity
- tolerance:
  - 1px at DPR 1x/2x
  - 2px otherwise

Test inputs:
- landscape source (1536x1024)
- portrait source (1024x1536)
- mixed view datasets (front/back/left/right)

## Phase F — Migration + Rollout Controls

Goal: safe transition from legacy presets/hardcoded placement.

Steps:
- Backfill script:
  - map legacy placement standards -> `customizationTemplateV1` presets.
  - map known view image paths by filename convention (front/back/left/right).
- Feature flag rollout:
  - `FF_CUSTOM_LAYOUT_TEMPLATE_V1` default OFF (already requested previously)
  - turn ON per environment/product cohort
- Monitor fallback usage + quote error rates.

---

## 6) How the Website Will Behave After Implementation

Admin:
- Step 4 becomes deterministic:
  - choose product print areas
  - author visual presets (rectNorm)
  - link presets to print areas
- No confusing empty non-action blocks; actionable setup links exist.

Storefront Customize:
- View images and preset rects render from saved template.
- Area selection controls available only for product-enabled areas.
- Size tier selection remains global (v1) or product-filtered (v2 option).
- Quote and mockup use same area/tier IDs and constraints.

Production/Operations:
- Pricing rules (`PRINT_FEE`, `EXTRA_SIDE`, etc.) remain tied to area + tier.
- Mockup sizing based on area max cm + selected tier cm remains intact.

---

## 7) Concrete Worklist (by app)

## 7.1 `apps/admin`

1. Add pages:
- `PrintAreasPage.tsx`
- `SizeTiersPage.tsx`

2. Add routes + sidebar entries.

3. Step 4 polish (`Step4_PrintConfig.tsx`):
- If no print areas: show CTA to `/print-areas`.
- Remove or mark read-only `Size Tiers` product selection (v1).
- Keep preset authoring and natural dimension capture.
- Keep hidden `View Image Path` internals if desired, but provide a robust autofill/mapping status badge.

## 7.2 `backend`

1. Add admin CRUD routes for print areas and size tiers.
2. Add zod validation + uniqueness conflict handling.
3. Optional: enforce preset `printAreaId` on layout-template save.
4. Optional v2: add product-level tier linking if needed.

## 7.3 `apps/store`

1. Keep `/api/customization/options` template-first ingestion.
2. Add fallback telemetry and explicit fallback guard.
3. Add parity E2E snapshots for view switching, resize, refresh.

---

## 8) Acceptance Criteria

1. Admin can create/edit/deactivate print areas and size tiers without DB access.
2. Step 4 never shows dead empty blocks without actionable CTA.
3. Preset rect saved in admin appears in storefront with parity tolerance.
4. Quote and mockup reject invalid area/tier combos with clear errors.
5. Legacy products continue to function during rollout.

---

## 9) Recommended Decision Log

Immediate decisions to lock:
1. Keep `size tiers` global in v1 (yes/no).
2. Require `printAreaId` per preset (yes/no).
3. Fallback policy for non-template products (strict/soft).
4. Rollout order by product family (BLANKS first).

---

## 10) External References (Production Guidance)

Placement + safe area concepts:
- Printful t-shirt placement guide:
  - https://www.printful.com/blog/t-shirt-design-placement-guide
- Printful safe print area:
  - https://help.printful.com/hc/en-us/articles/10720620016540-What-is-the-safe-print-area
- Printify safe area and bleed:
  - https://help.printify.com/hc/en-us/articles/4483626015889-What-are-safe-areas-and-bleeds-
- Printify design guide:
  - https://printify.com/guide/design-guide/

Artwork quality standards:
- Printful file requirements:
  - https://support.printful.com/hc/en-us/articles/41396495537553-What-type-of-print-files-does-Printful-require
- Transfer Express artwork guidelines (DTF-related):
  - https://blog.transferexpress.com/art-guidelines/
  - https://www.transferexpress.com/heat-applied-transfers/ultracolor-soft

Canvas/interaction implementation references:
- Konva responsive stage:
  - https://konvajs.org/docs/sandbox/Responsive_Canvas.html
- Konva drag bounds:
  - https://konvajs.org/docs/drag_and_drop/Simple_Drag_Bounds.html
- Konva transformer ratio behavior:
  - https://konvajs.org/docs/select_and_transform/Keep_Ratio.html

---

## 11) Final Recommendation

Implement Phase A + B first.
- This gives immediate operator usability and removes current confusion.
- It does not break existing quote/mockup/storefront behavior.

Then implement C + D + E + F to complete production-hardening and migration safety.
