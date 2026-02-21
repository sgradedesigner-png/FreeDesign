# BLANKS Customization Layout Wizard Plan

## 1) Goal
Build an admin-first layout authoring flow so each BLANKS product can define:
- View images (`front`, `back`, `left`, `right`)
- Garment bounds and safe frame
- Named print presets (example: `Front Chest`, `Back Full`)
- GhostRect coordinates via drag/resize handles

And ensure the storefront route `http://localhost:5184/customize/blank-sweatshirt` renders from this authored data (not hardcoded per-code overrides).

## 2) Deep-Read Findings (Current Gaps)

1. BLANKS wizard currently hides print config step.
- `apps/admin/src/components/product-wizard/product-family/familyConfig.ts:39`
- `apps/admin/src/components/product-wizard/product-family/familyConfig.ts:57`

2. Step4 only supports checkbox selection for global print areas/tiers; no view canvas, no GhostRect editor.
- `apps/admin/src/components/product-wizard/steps/Step4_PrintConfig.tsx:46`
- `apps/admin/src/components/product-wizard/steps/Step4_PrintConfig.tsx:61`
- `apps/admin/src/components/product-wizard/steps/Step4_PrintConfig.tsx:72`

3. Backend `print_areas` model has only max size fields, no per-product/per-view rectangle coordinates.
- `backend/prisma/schema.prisma:404` (PrintArea model region)
- `backend/prisma/schema.prisma:423` (ProductPrintArea link only)

4. Store customization rendering is static-file driven today (`garmentBounds.json`, `placementStandards.json`) and patched with manual overrides.
- `apps/store/src/lib/garmentBoundsLoader.ts:2`
- `apps/store/src/lib/placementLoader.ts:2`
- `apps/store/src/hooks/usePlacementEngine.ts:64`
- `apps/store/src/components/customize/PlacementPresetBar.tsx:6`

5. `/api/customization/options` returns print areas and max sizes for pricing flow, but not per-view placement geometry.
- `backend/src/routes/customization.ts:109`

6. Wizard create route persists `printAreas`, but update route does not accept same fields.
- create: `backend/src/routes/admin/products.ts:157`
- create link persist: `backend/src/routes/admin/products.ts:239`
- update route starts: `backend/src/routes/admin/products.ts:473`

7. Wizard edit hook expects `product.product_print_areas`, but product `GET /admin/products/:id` includes only category/variants; relation shape mismatch risk.
- `apps/admin/src/hooks/useProductWizard.ts:179`
- `backend/src/routes/admin/products.ts:338`

## 3) Target Architecture (Author Once, Render Exactly)

Use a **normalized authoring model** plus a **compiled snapshot** for storefront speed and stability.

1. Authoring tables (new):
- `product_layout_templates`
- `product_layout_views`
- `product_layout_presets`

2. Compiled snapshot (denormalized JSON) stored in `Product.metadata.customizationTemplateV1`.
- Fast for storefront.
- Versioned for future migration.
- Generated after every admin save/publish.

3. Storefront rendering source of truth:
- `customizationTemplateV1` from backend.
- Fallback to static JSON (`garmentBounds.json` + `placementStandards.json`) only when template missing.

## 4) Data Contract

`customizationTemplateV1` (suggested shape):

```json
{
  "version": 1,
  "productTypeKey": "sweatshirt",
  "referenceWidthCm": {
    "frontBack": 38.1,
    "sides": 25.0
  },
  "views": {
    "front": {
      "imageFile": "Sweatshirt Front.png",
      "imgPx": { "w": 1536, "h": 1024 },
      "boxPx": { "x1": 347, "y1": 65, "x2": 1185, "y2": 953 },
      "safeFrame": { "x1": 388.95, "y1": 109.45, "x2": 1144.05, "y2": 909.55 },
      "center": { "x": 766.5, "y": 509.5 }
    }
  },
  "presets": [
    {
      "id": "front_left_chest",
      "view": "front",
      "label": { "mn": "Left Chest", "en": "Left Chest" },
      "widthCm": 8.9,
      "heightCm": 8.9,
      "topFromCollarCm": 14.0,
      "leftFromCenterCm": 12.7,
      "sortOrder": 20,
      "isDefault": false,
      "printAreaId": "uuid-or-null"
    }
  ]
}
```

### 4.1 Placement Geometry Storage (Hard Requirement)

1. All placement rectangles MUST be stored as normalized image-space coordinates:
- `x`, `y`, `w`, `h` in `[0..1]`
- Relative to the view image natural bounds

2. No canvas/display pixel coordinates may be persisted as source-of-truth.

3. Pixel dimensions may be stored only as immutable reference metadata for validation/debug:
- `naturalWidth`
- `naturalHeight`

4. Derived cm fields (`width_cm`, `height_cm`, `top_from_collar_cm`, `left_from_center_cm`) may exist for business/rule compatibility, but normalized geometry remains the canonical layout source.

### 4.2 DB Schema Enforcement Checklist

1. `product_layout_presets` add canonical normalized columns:
- `x_norm` (numeric)
- `y_norm` (numeric)
- `w_norm` (numeric)
- `h_norm` (numeric)

2. DB CHECK constraints:
- `0 <= x_norm <= 1`
- `0 <= y_norm <= 1`
- `0 < w_norm <= 1`
- `0 < h_norm <= 1`
- `x_norm + w_norm <= 1`
- `y_norm + h_norm <= 1`

3. Optional compatibility columns (cm) are non-canonical:
- keep nullable or computed
- never overwrite canonical `*_norm` from display px

4. `product_layout_views` store immutable image metadata for validation:
- `natural_width_px int not null`
- `natural_height_px int not null`
- plus `box_px/safe_frame/center`

5. Migration guard:
- reject rows with invalid normalized values
- backfill legacy rows using existing cm->image conversion once, then lock canonical to normalized

## 5) Admin UX Plan

### Step 5.1 BLANKS flow visibility
Change BLANKS to include print-layout step:
- `apps/admin/src/components/product-wizard/product-family/familyConfig.ts`

### Step 5.2 Replace Step4 with layout editor
Upgrade `Step4_PrintConfig` into:
- View tabs: Front/Back/Left/Right
- Canvas preview (Konva) with image fit logic
- GhostRect with drag + 4-corner resize handles
- Inputs mirrored with live rectangle:
  - `name/key`
  - `widthCm`, `heightCm`
  - `topFromCollarCm`, `leftFromCenterCm`
  - optional `printAreaId` mapping
- Preset list panel:
  - Add / Duplicate / Delete / Reorder
  - One default preset per view

Files:
- `apps/admin/src/components/product-wizard/steps/Step4_PrintConfig.tsx`
- new: `apps/admin/src/components/product-wizard/layout/GarmentLayoutEditor.tsx`
- new: `apps/admin/src/components/product-wizard/layout/LayoutPresetList.tsx`
- new: `apps/admin/src/components/product-wizard/layout/LayoutPresetForm.tsx`

### Step 5.3 Variant media mapping by view (critical)
Avoid fragile gallery index assumptions.
- Add explicit per-view image mapping in admin variant step.
- Persist as `variant.viewImagePaths` (new column/json) or `variant.metadata.viewImagePaths`.

Files:
- `apps/admin/src/components/product-wizard/steps/Step5_Variants.tsx`
- backend schema + routes (see section 6)

## 6) Backend/API Plan

### Step 6.1 Schema changes
Add tables:
- `ProductLayoutTemplate` (`productId`, `version`, `isActive`)
- `ProductLayoutView` (`templateId`, `view`, `imgPx`, `boxPx`, `safeFrame`, `center`, `imagePath`)
- `ProductLayoutPreset` (`templateId`, `key`, `labelMn`, `labelEn`, `view`, geometry cm fields, `sortOrder`, `isDefault`, `printAreaId?`)

Optionally add explicit variant view map:
- `ProductVariant.viewImagePaths Json?`

Files:
- `backend/prisma/schema.prisma`
- new migration SQL

### Step 6.2 Admin APIs
Add CRUD:
- `GET /api/admin/products/:id/layout-template`
- `PUT /api/admin/products/:id/layout-template`
- validation with strict zod

Required API validation rules:
- Input accepts normalized geometry only as canonical payload.
- Reject payloads containing only display/canvas px coordinates.
- If px fields are provided, treat as debug metadata only.
- Enforce same bounds as DB checks before transaction.

Recommended request payload for each preset:

```json
{
  "key": "front_left_chest",
  "view": "front",
  "labelMn": "Left Chest",
  "labelEn": "Left Chest",
  "rectNorm": { "x": 0.42, "y": 0.18, "w": 0.16, "h": 0.12 },
  "printAreaId": "uuid-or-null",
  "sortOrder": 20,
  "isDefault": false
}
```

Validation:
- `rectNorm.x/y/w/h` required
- finite number
- bounds and non-overflow checks
- view must exist in template views

### Step 6.4 Read/Render Conversion Contract

1. Save path:
- Admin editor works in screen px
- Convert px -> normalized (`x_norm,y_norm,w_norm,h_norm`) at save time
- Persist normalized only as canonical

2. Read path:
- Storefront reads normalized
- Convert normalized -> image px -> canvas px with shared transform utility
- No direct dependence on previous viewport dimensions

3. Round-trip rule:
- `px -> norm -> px` should be idempotent within tolerance budget (section 8.1)

Also fix/update existing product route contract:
- include print area relations in `GET /admin/products/:id`
- support printAreas/defaults update in `PUT /admin/products/:id`

Files:
- `backend/src/routes/admin/products.ts`
- new: `backend/src/routes/admin/layout-template.ts`
- `backend/src/app.ts` route registration

### Step 6.3 Store customization API payload
Extend:
- `GET /api/customization/options`
Return:
- `layoutTemplate` compiled JSON for active product/variant

File:
- `backend/src/routes/customization.ts`

## 7) Storefront Integration Plan

### Step 7.1 Runtime source switch
Load template from backend first, fallback to static JSON.

Files:
- `apps/store/src/pages/CustomizePage.tsx`
- `apps/store/src/hooks/usePlacementEngine.ts`
- `apps/store/src/components/customize/PlacementPresetBar.tsx`
- new: `apps/store/src/lib/layoutTemplateLoader.ts`

### Step 7.2 Remove hardcoded per-key tuning drift
Current manual overrides in `usePlacementEngine`/`PlacementPresetBar` should become data-driven.

Files:
- `apps/store/src/hooks/usePlacementEngine.ts`
- `apps/store/src/components/customize/PlacementPresetBar.tsx`

### Step 7.3 Keep visual parity with `/customize/blank-sweatshirt`
Acceptance:
- Same view image scale behavior (4:3 stage, centered fit)
- Same ghost rect/preset coordinates
- Same tab switching behavior

Files:
- `apps/store/src/components/customize/KonvaCustomizeCanvas.tsx`
- `apps/store/src/components/customize/KonvaDesignImage.tsx`
- `apps/store/src/components/customize/ViewSwitcherTabs.tsx`

## 8) Correctness Strategy (No Regression)

1. Single math function shared between admin editor and storefront renderer.
- Extract to shared utility (same cm↔px transform).

2. Round-trip tests:
- Save preset in admin.
- Fetch from API.
- Recompute px rect in store.
- Must match within tolerance (`<=1px`).

3. Contract tests:
- Zod validation for template payload.
- Reject malformed coordinates (`negative`, `NaN`, out-of-image bounds).

4. E2E test path:
- Create BLANKS product in wizard.
- Configure Front/Back/Left/Right presets with GhostRect.
- Open storefront `/customize/:slug`.
- Assert first preset auto-places as authored.

### 8.1 Parity / Drift Test (Hard Requirement)

After `save -> reload`, rendered placement must match authored placement within tolerance:

1. Tolerance:
- `1px` at DPR `1x/2x`
- `2px` otherwise

2. No drift allowed on:
- browser refresh
- responsive resize
- different viewport sizes

3. Test implementation:
- Persist authored normalized rect
- Re-open editor and storefront render
- Compare rendered screen-space corners to authored expected corners under same viewport/DPR
- Fail build if tolerance exceeded

4. API contract tests (must add):
- Reject out-of-range normalized payloads
- Reject overflow rectangles (`x+w>1`, `y+h>1`)
- Accept valid normalized payloads and return unchanged canonical values

5. Cross-viewport deterministic tests:
- save at viewport A, render at viewport B/C
- verify visual position parity through normalized projection

## 9) Migration/Backfill

1. Backfill script:
- Read current `apps/store/src/data/garmentBounds.json`
- Read current `apps/store/src/data/placementStandards.json`
- Seed `product_layout_*` for existing BLANKS products.

2. Flag rollout:
- `FF_CUSTOM_LAYOUT_TEMPLATE_V1`
- On: API-driven templates.
- Off: legacy static JSON path.

## 10) Implementation Sequence (Recommended)

1. Fix contract inconsistencies first.
- `GET/PUT /admin/products/:id` print area behavior and payload parity.

2. Add schema + admin layout-template API.

3. Implement admin Step4 layout editor (Konva ghost rect authoring).

4. Extend `/api/customization/options` with `layoutTemplate`.

5. Integrate storefront to template-driven engine with fallback.

6. Add e2e + integration tests and remove most hardcoded overrides.

## 11) Definition of Done

1. Admin wizard (BLANKS) can:
- Create named preset per view.
- Drag/resize GhostRect.
- Save/reopen without coordinate drift.

2. Storefront customize page:
- Uses saved admin presets.
- First preset auto-applies on view switch.
- Visual output matches authored positions.

3. Legacy products still work via fallback until migrated.
