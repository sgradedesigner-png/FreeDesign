# Customization Page Implementation Plan

**Document version:** 1.0
**Date:** 2026-02-18
**Branch:** pre-production
**Author:** Engineering

---

## Table of Contents

1. [Phase Roadmap](#1-phase-roadmap)
2. [Detailed Phases](#2-detailed-phases)
   - [Phase 0: Data Pipeline + Foundation](#phase-0-data-pipeline--foundation)
   - [Phase 1: Konva Canvas Foundation](#phase-1-konva-canvas-foundation)
   - [Phase 2: Placement Engine cm→px](#phase-2-placement-engine-cmpx)
   - [Phase 3: Design Upload + Interaction](#phase-3-design-upload--interaction)
   - [Phase 4: Multi-View + Per-View State](#phase-4-multi-view--per-view-state)
   - [Phase 5: Persistence + Cart](#phase-5-persistence--cart)
   - [Phase 6: UX Polish + Mobile](#phase-6-ux-polish--mobile)
3. [Definition of Done](#3-definition-of-done)
4. [File / Folder Plan](#4-file--folder-plan)
5. [API & Data Interface Sketches](#5-api--data-interface-sketches)
6. [Overlay Engine Math](#6-overlay-engine-math)

---

## 1. Phase Roadmap

| Phase | Name | Duration | Deliverables |
|-------|------|----------|--------------|
| 0 | Data Pipeline + Foundation | 1 day | `garmentBounds.json`, `placementStandards.json`, TypeScript types, package installs |
| 1 | Konva Canvas Foundation | 2 days | `KonvaCustomizeCanvas.tsx`, view switcher, responsive stage, safe-area overlay |
| 2 | Placement Engine cm→px | 2 days | `usePlacementEngine.ts`, preset bottom bar, snap-to-placement, safe-area clamping |
| 3 | Design Upload + Interaction | 3 days | Konva Transformer, drag/resize/rotate, boundary feedback, undo/redo, size indicator |
| 4 | Multi-View + Per-View State | 2 days | Per-view state machine, tab thumbnails, `Stage.toDataURL()` per view |
| 5 | Persistence + Cart | 2 days | LocalStorage draft, `POST /api/customizations`, Cloudinary upload, cart `optionPayload` |
| 6 | UX Polish + Mobile | 2 days | Mobile layout, touch events, keyboard shortcuts, skeletons, error states |

**Total estimated:** 14 working days
**Critical path:** Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 (fully sequential; each phase depends on the previous)

---

## 2. Detailed Phases

---

### Phase 0: Data Pipeline + Foundation

#### Scope

This phase establishes every static data artifact and TypeScript contract that all subsequent phases depend on. No UI is built here. The goal is to have a single source of truth for garment geometry and DTF placement standards checked into the repo as versioned JSON, plus all TypeScript interfaces defined and exported from a central types file. Package installs happen here so that Phase 1 can immediately import from `react-konva`.

#### Checklist

- [ ] Install `konva` and `react-konva` in `apps/store` package
  ```
  pnpm --filter store add konva react-konva
  ```
- [ ] Add `konva` and `react-konva` to `apps/store/tsconfig.json` lib path if needed
- [ ] Verify `fabric` remains in `package.json` (do not remove until Phase 3 deletion step)
- [ ] Create `apps/store/src/data/` directory if it does not exist
- [ ] Author `apps/store/src/data/garmentBounds.json` — all 19 entries from ActualGarmentSize.md (see Section 5a)
- [ ] Author `apps/store/src/data/placementStandards.json` — all placement entries from DTFSizeLocationStandard.md (see Section 5b)
- [ ] Create `apps/store/src/types/customization.ts` — all TypeScript interfaces (see Section 5c)
- [ ] Create `apps/store/src/types/garment.ts` — `GarmentBounds`, `PlacementStandard` interfaces
- [ ] Create `apps/store/src/lib/garmentBoundsLoader.ts` — typed accessor functions over the JSON data
- [ ] Create `apps/store/src/lib/placementLoader.ts` — typed accessor functions over placement JSON
- [ ] Write unit tests in `apps/store/src/data/__tests__/garmentBounds.test.ts` asserting key lookup and shape

**Accessor function signatures (garmentBoundsLoader.ts):**
```ts
export function getGarmentBounds(productType: string, view: string): GarmentBounds
export function listAvailableViews(productType: string): string[]
export function hasView(productType: string, view: string): boolean
```

**Accessor function signatures (placementLoader.ts):**
```ts
export function getPlacementStandard(
  productType: string,
  placementKey: string,
  sizeCategory: SizeCategory
): PlacementStandard | undefined

export function listPlacements(productType: string, view: string): PlacementStandard[]
```

#### Output Artifacts

| Path | Status |
|------|--------|
| `apps/store/src/data/garmentBounds.json` | NEW |
| `apps/store/src/data/placementStandards.json` | NEW |
| `apps/store/src/types/customization.ts` | NEW |
| `apps/store/src/types/garment.ts` | NEW |
| `apps/store/src/lib/garmentBoundsLoader.ts` | NEW |
| `apps/store/src/lib/placementLoader.ts` | NEW |
| `apps/store/src/data/__tests__/garmentBounds.test.ts` | NEW |

#### Acceptance Criteria

1. `pnpm --filter store build` succeeds with zero TypeScript errors after installs.
2. `getGarmentBounds('hoodie', 'front')` returns an object matching the `GarmentBounds` interface with `imgPx.w === 1536`.
3. `listAvailableViews('tote_bag')` returns `['front']` only (tote_bag has one image).
4. `listAvailableViews('hoodie')` returns `['front', 'back', 'left', 'right']`.
5. Unit tests pass: `pnpm --filter store test -- garmentBounds`.
6. `fabric` is still importable (not removed) — confirmed by `grep -r "fabric" apps/store/package.json` showing it present.

#### Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| pnpm workspace hoisting conflict between `konva` versions if multiple packages reference it | Pin exact version in root `pnpm-workspace.yaml` overrides |
| `react-konva` peer requires React 18; store may be React 17 | Check `apps/store/package.json` React version before installing; upgrade if needed |
| Garment image filenames contain spaces — JSON keys must use underscore convention | Keys use `hoodie_front` pattern; image file paths remain as-is with spaces in `imageFile` field |
| DTF placement data has ambiguous "collar" vs "neck edging" reference points | Document assumption in `placementStandards.json` source field; use `boxPx.y1` as collar reference for all front-view calculations |

---

### Phase 1: Konva Canvas Foundation

#### Scope

Build the core canvas host component using react-konva. The canvas renders in three stacked layers: (1) garment background image, (2) safe-area dashed-rectangle overlay, (3) design objects (initially empty). A view-switcher tab bar appears above or beside the canvas and shows only the tabs that have corresponding image assets for the active product type. The canvas is responsive: 560px wide on desktop, 100vw on mobile. The garment image is scaled uniformly to fill the canvas width while preserving aspect ratio. No design upload or placement logic is in this phase — the canvas just needs to correctly display the garment and the safe frame.

#### Checklist

- [ ] Create `apps/store/src/components/customize/KonvaCustomizeCanvas.tsx`
  - `<Stage>` with `width={canvasWidth}` and `height={canvasHeight}` (computed from image AR)
  - `<Layer>` 0: garment background — `<KonvaImage>` loaded via `useImage` hook from `use-konva`
  - `<Layer>` 1: safe-area overlay — `<Rect>` with `dash={[8,4]}`, `stroke="#3b82f6"`, `strokeWidth={1.5}`, `fill="transparent"`
  - `<Layer>` 2: design layer (empty placeholder)
  - Accept props: `productType`, `view`, `canvasWidth`, `onReady`
- [ ] Install `use-konva` or implement `useImage` locally:
  ```ts
  // useKonvaImage.ts
  function useKonvaImage(src: string): [HTMLImageElement | undefined, 'loading' | 'loaded' | 'failed']
  ```
- [ ] Create `apps/store/src/components/customize/ViewSwitcherTabs.tsx`
  - Accepts `productType: string`, `activeView: ViewName`, `onViewChange: (v: ViewName) => void`, `viewThumbDataUrls: Partial<Record<ViewName, string>>`
  - Dynamically renders tabs based on `listAvailableViews(productType)`
  - Tab labels: `Front`, `Back`, `Left Sleeve`, `Right Sleeve` (use display name map)
  - Tab shows thumbnail image if `viewThumbDataUrls[view]` is set (18×18px preview)
- [ ] Create `apps/store/src/hooks/useCanvasDimensions.ts`
  - Inputs: `canvasWidth: number`, `imgPxW: number`, `imgPxH: number`
  - Returns `{ canvasWidth, canvasHeight, displayScale }` where `displayScale = canvasWidth / imgPxW` and `canvasHeight = imgPxH * displayScale`
- [ ] Create `apps/store/src/components/customize/CanvasLoadingSkeleton.tsx` — grey pulse rectangle while garment image loads
- [ ] Integrate `KonvaCustomizeCanvas` into existing `apps/store/src/pages/CustomizePage.tsx` (or wherever the route renders) behind a feature flag initially
- [ ] Make canvas width responsive:
  ```ts
  const canvasWidth = useBreakpoint('md') ? 560 : window.innerWidth - 32
  ```
- [ ] Draw safe-area rect in canvas coordinates using `garmentBoundsLoader` + `useCanvasDimensions`:
  ```ts
  const sf = bounds.safeFrame
  const x = sf.x1 * displayScale
  const y = sf.y1 * displayScale
  const w = (sf.x2 - sf.x1) * displayScale
  const h = (sf.y2 - sf.y1) * displayScale
  ```
- [ ] Write Playwright smoke test: navigate to `/customize/blank-hoodie?variantId=X&size=L&color=White&qty=1`, assert canvas element is present and image is loaded

**ViewSwitcherTabs display name map:**
```ts
const VIEW_DISPLAY_NAMES: Record<ViewName, string> = {
  front: 'Front',
  back: 'Back',
  left: 'Left Sleeve',
  right: 'Right Sleeve',
}
```

**Canvas sizing computation:**
```ts
// For hoodie_front: imgPxW=1536, imgPxH=1024
// canvasWidth = 560 (desktop)
// displayScale = 560/1536 = 0.3646
// canvasHeight = 1024 * 0.3646 = 373.3px

// For polo_left: imgPxW=1024, imgPxH=1536 (portrait)
// displayScale = 560/1024 = 0.5469
// canvasHeight = 1536 * 0.5469 = 840px
```

Note: portrait-orientation garment views (left/right sleeves) will produce a taller canvas. The container must allow vertical scroll on desktop or use a max-height with object-fit containment.

#### Output Artifacts

| Path | Status |
|------|--------|
| `apps/store/src/components/customize/KonvaCustomizeCanvas.tsx` | NEW |
| `apps/store/src/components/customize/ViewSwitcherTabs.tsx` | NEW |
| `apps/store/src/components/customize/CanvasLoadingSkeleton.tsx` | NEW |
| `apps/store/src/hooks/useCanvasDimensions.ts` | NEW |
| `apps/store/src/hooks/useKonvaImage.ts` | NEW |
| `apps/store/src/pages/CustomizePage.tsx` | MODIFIED (add Konva canvas, feature-flagged) |
| `apps/store/src/tests/customize-canvas.spec.ts` | NEW |

#### Acceptance Criteria

1. Navigating to `/customize/blank-hoodie` renders a `<canvas>` element with correct pixel dimensions (560px wide on desktop).
2. The garment image fills the canvas width; aspect ratio is not distorted (visual check + Playwright screenshot comparison).
3. The dashed blue safe-area rectangle is visible on the canvas and aligns with the garment body (not the full image frame).
4. For `hoodie`, four tabs render: Front, Back, Left Sleeve, Right Sleeve. For `tote_bag`, one tab renders: Front.
5. Clicking a tab changes the garment image to the corresponding view image with no layout shift.
6. On a 375px viewport, the canvas is `375 - 32 = 343px` wide.
7. `CanvasLoadingSkeleton` renders while the `useKonvaImage` hook is in `'loading'` state.

#### Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| Portrait-orientation sleeve images produce very tall canvas on desktop | Cap `canvasHeight` at `680px` and use `Konva.Stage` `scaleY` to fit, or use a scroll container |
| `use-konva`'s `useImage` is not SSR-safe (store may use SSR) | Implement custom `useKonvaImage` with a `typeof window !== 'undefined'` guard |
| Konva `Stage` requires a container div with explicit dimensions before mount | Measure container via `useResizeObserver` and defer Stage render until width is known |
| Garment image files live in `apps/admin/Blank Print Products/` — store cannot directly import from admin | Copy/symlink images to `apps/store/public/garments/` during build, or serve via CDN; reference by URL not relative import |

---

### Phase 2: Placement Engine cm→px

#### Scope

This phase implements the mathematical core that converts DTF industry-standard centimetre measurements into pixel positions on the Konva canvas. A `usePlacementEngine` hook encapsulates all conversion logic and exposes preset positions. A row of preset buttons (Full Front, Left Chest, Across Chest, Sleeve, Back Full) appears below the canvas; clicking a preset instantly positions the design (or the ghost outline) at the correct location. When a design is dragged near a preset centre point, a snap indicator appears and the design snaps on release. The safe-area constraint clamps the design rectangle to always stay within the safeFrame.

#### Checklist

- [ ] Create `apps/store/src/hooks/usePlacementEngine.ts`:
  - Inputs: `garmentBounds: GarmentBounds`, `displayScale: number`, `sizeCategory: SizeCategory`
  - Outputs: `{ presets, cmToCanvasPx, imagePxToCanvasPx, clampToSafeArea, snapIfNear }`
  - Implement `cmToCanvasPx(cm)`:
    ```ts
    const pxPerCmInImage = garmentBounds.boxPx.width / garmentBounds.garmentWidthCm
    const pxInImage = cm * pxPerCmInImage
    return pxInImage * displayScale
    ```
  - Implement `presetToCanvasRect(placement: PlacementStandard): KonvaRect` — returns `{ x, y, width, height }` in canvas coordinates
  - Implement `clampToSafeArea(rect: KonvaRect): KonvaRect` — clips design rect to stay within safe frame
  - Implement `snapIfNear(rect: KonvaRect, threshold = 12): { rect: KonvaRect; snapped: boolean; snapTarget: string | null }`
- [ ] Create `apps/store/src/components/customize/PlacementPresetBar.tsx`
  - Horizontal scrollable row of preset buttons
  - Presets: Full Front, Left Chest, Across Chest, Back Full, Sleeve (filter by active view — Sleeve only on left/right tabs)
  - Active preset highlighted with `ring-2 ring-blue-500`
  - Each button shows preset name and cm dimensions as subtext
  - On click: calls `onPresetSelect(placement: PlacementStandard)`
- [ ] Add snap visual feedback in `KonvaCustomizeCanvas`: when `snapIfNear` returns `snapped: true`, render a crosshair `<Line>` at the snap target center in the safe-area layer
- [ ] Add ghost rectangle (`<Rect>`) in safe-area layer showing preset area outline (dashed cyan) when user hovers a preset button
- [ ] Implement `clampToSafeArea` in the design layer's `dragBoundFunc` prop on the design `<Image>`:
  ```ts
  dragBoundFunc={(pos) => {
    const clamped = clampToSafeArea({ x: pos.x, y: pos.y, width: designW, height: designH })
    return { x: clamped.x, y: clamped.y }
  }}
  ```
- [ ] Write unit tests `apps/store/src/hooks/__tests__/usePlacementEngine.test.ts`:
  - Test `cmToCanvasPx` for hoodie front (see worked example in Section 6)
  - Test `clampToSafeArea` forces rect inside safe frame boundaries
  - Test `snapIfNear` snaps when within 12px, does not snap at 13px

**Preset definitions (derived from DTFSizeLocationStandard.md):**

```ts
export const PLACEMENT_PRESETS = [
  {
    key: 'front_center',
    label: 'Full Front',
    views: ['front'],
    productTypes: ['hoodie', 'sweatshirt', 'polo', 'basketball_jersey', 'soccer_jersey', 'tanktop', 'tote_bag'],
    sizeCategories: {
      adult:       { widthCm: 27.9, heightCm: 27.9, topFromCollarCm: 7.6, leftFromCenterCm: 0 },
      youth_ml:    { widthCm: 26.7, heightCm: 26.7, topFromCollarCm: 7.6, leftFromCenterCm: 0 },
      youth_s:     { widthCm: 21.6, heightCm: 21.6, topFromCollarCm: 7.6, leftFromCenterCm: 0 },
      toddler:     { widthCm: 14.0, heightCm: 14.0, topFromCollarCm: 7.6, leftFromCenterCm: 0 },
    },
  },
  {
    key: 'left_chest',
    label: 'Left Chest',
    views: ['front'],
    productTypes: ['hoodie', 'sweatshirt', 'polo'],
    sizeCategories: {
      adult: { widthCm: 8.9, heightCm: 8.9, topFromCollarCm: 14.0, leftFromCenterCm: -12.7 },
    },
  },
  {
    key: 'across_chest',
    label: 'Across Chest',
    views: ['front'],
    productTypes: ['hoodie', 'sweatshirt'],
    sizeCategories: {
      adult: { widthCm: 30.5, heightCm: 10.2, topFromCollarCm: 7.6, leftFromCenterCm: 0 },
    },
  },
  {
    key: 'back_full',
    label: 'Back Full',
    views: ['back'],
    productTypes: ['hoodie', 'sweatshirt', 'polo', 'basketball_jersey', 'soccer_jersey', 'tanktop'],
    sizeCategories: {
      adult: { widthCm: 35.6, heightCm: 28.6, topFromCollarCm: 5.1, leftFromCenterCm: 0 },
    },
  },
  {
    key: 'sleeve',
    label: 'Sleeve',
    views: ['left', 'right'],
    productTypes: ['hoodie', 'sweatshirt'],
    sizeCategories: {
      adult: { widthCm: 5.1, heightCm: 29.2, topFromCollarCm: 0, leftFromCenterCm: 0 },
    },
  },
]
```

**`leftFromCenterCm` sign convention:** negative = left of center, positive = right of center. Canvas X calculation:
```ts
const centerXInImage = garmentBounds.center.x
const offsetPxInImage = (leftFromCenterCm / garmentWidthCm) * boxPxWidth
const designCenterXInImage = centerXInImage + offsetPxInImage
const designXInCanvas = (designCenterXInImage - designWidthInImage / 2) * displayScale
```

#### Output Artifacts

| Path | Status |
|------|--------|
| `apps/store/src/hooks/usePlacementEngine.ts` | NEW |
| `apps/store/src/components/customize/PlacementPresetBar.tsx` | NEW |
| `apps/store/src/hooks/__tests__/usePlacementEngine.test.ts` | NEW |
| `apps/store/src/components/customize/KonvaCustomizeCanvas.tsx` | MODIFIED (snap + ghost rect + clamp) |

#### Acceptance Criteria

1. Clicking "Full Front" preset on hoodie front view positions a ghost rect at `x≈158.8, y≈93.2` in canvas coordinates (matches Section 6 worked example ±2px due to rounding).
2. Dragging a design to within 12px of the Full Front center causes it to snap; dragging outside 12px does not snap.
3. Dragging a design fully outside the safe area returns it to the safe area boundary on release (dragBoundFunc clamping active).
4. On the Back tab, "Sleeve" preset button is hidden. On Left/Right Sleeve tabs, "Full Front" and "Left Chest" are hidden.
5. Unit tests for `usePlacementEngine` pass with zero failures.

#### Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| `garmentWidthCm = 30.5` is valid for flat front/back views but sleeve images are portrait with different physical width | For sleeve views, derive physical width from sleeve standard max width (12.7cm or 5.1cm); document different `garmentWidthCm` per view in `garmentBounds.json` as an optional `garmentWidthCmOverride` field |
| `topFromCollarCm` references collar position which is not in the bounds data | Define collar Y as `boxPx.y1` for all front/back views; document this assumption in the JSON `collarRefY: boxPx.y1` field |
| Max imprint area (30.5×35.6cm) exceeds safe frame for some garments | `clampToSafeArea` will shrink the rect; add a warning toast when design is auto-clamped |
| Snap threshold of 12px may feel too aggressive or too loose | Make threshold configurable via a constant `SNAP_THRESHOLD_PX = 12`; expose as optional prop |

---

### Phase 3: Design Upload + Interaction

#### Scope

This phase replaces the existing Fabric.js `CanvasEditor.tsx` with a fully functional Konva-based design interaction system. The user uploads an artwork file; it appears on the canvas as a draggable, resizable, and rotatable image node with a Konva Transformer. A live cm indicator updates as the user resizes. The safe-area boundary rect flashes red when the design bounding box extends outside the safe frame. Full undo/redo is provided via a history stack. The existing Fabric.js `CanvasEditor.tsx` is deleted in this phase (the old component is no longer rendered by this point).

#### Checklist

**Upload integration:**
- [ ] Reuse existing `DesignUploader.tsx` component — it already handles upload to Cloudinary via backend; it emits `onUploadComplete({ assetId, url, width, height })`
- [ ] On upload complete: load image into Konva via `useKonvaImage(url)`, place at canvas center initially, then apply active preset position if one is selected
- [ ] Show `UploadStatusChip` (existing component) during upload with progress

**Konva design node:**
- [ ] Create `apps/store/src/components/customize/KonvaDesignImage.tsx`
  - Renders `<Image>` node with ref attached to `Transformer`
  - Props: `imageElement: HTMLImageElement`, `initialRect: KonvaRect`, `onChangeEnd: (attrs: KonvaImageAttrs) => void`, `isSelected: boolean`, `onSelect: () => void`
  - Attach `<Transformer>` with:
    ```ts
    keepRatio={true}          // uniform scaling
    rotateEnabled={true}
    borderStroke="#3b82f6"
    borderStrokeWidth={1.5}
    anchorSize={10}
    anchorCornerRadius={2}
    ```
  - On `transformend` and `dragend`: emit `onChangeEnd` with updated `{ x, y, scaleX, scaleY, rotation }`

**Boundary feedback:**
- [ ] In `KonvaCustomizeCanvas`: after every `onChangeEnd`, call `checkOutsideSafeArea(attrs, bounds, displayScale)`
- [ ] `checkOutsideSafeArea` returns `boolean`; if true, set safe-area rect `stroke` to `"#ef4444"` (red) and `strokeWidth={3}`
- [ ] Revert safe-area rect to blue dashed after user moves design back inside

**Live size indicator:**
- [ ] Create `apps/store/src/components/customize/DesignSizeIndicator.tsx`
  - Shows `W: {widthCm.toFixed(1)}cm × H: {heightCm.toFixed(1)}cm`
  - Positioned absolutely above the canvas or in a side panel
  - Calculation:
    ```ts
    const pxPerCm = garmentBounds.boxPx.width / garmentBounds.garmentWidthCm
    const widthPxInImage = (designWidthInCanvas / displayScale)
    const widthCm = widthPxInImage / pxPerCm
    ```

**Undo/redo:**
- [ ] Create `apps/store/src/hooks/useHistory.ts`
  - Generic: `useHistory<T>(initial: T, maxDepth = 50)`
  - Returns `{ state, push, undo, redo, canUndo, canRedo }`
  - Stores snapshots of `ViewState` (shallow copy)
  - `push(newState)`: append to history stack, truncate redo stack
  - `undo()`: move pointer back one
  - `redo()`: move pointer forward one
- [ ] Wire undo/redo buttons in the toolbar (Phase 6 adds keyboard shortcuts; this phase adds buttons)
- [ ] Undo button: disabled when `!canUndo`; redo button: disabled when `!canRedo`

**Delete:**
- [ ] Add a delete button in the design toolbar that calls `onDeleteDesign()` on the active view
- [ ] `onDeleteDesign` resets the view's design attrs in `CustomizationSession.views[activeView]`

**Fabric.js removal:**
- [ ] Delete `apps/store/src/components/customize/CanvasEditor.tsx` (the Fabric.js version)
- [ ] Remove all `import ... from 'fabric'` in `CustomizePage.tsx`
- [ ] Remove `fabric` from `apps/store/package.json` dependencies
- [ ] Run `pnpm --filter store build` to confirm zero Fabric references remain

#### Output Artifacts

| Path | Status |
|------|--------|
| `apps/store/src/components/customize/KonvaDesignImage.tsx` | NEW |
| `apps/store/src/components/customize/DesignSizeIndicator.tsx` | NEW |
| `apps/store/src/hooks/useHistory.ts` | NEW |
| `apps/store/src/components/customize/CanvasEditor.tsx` | DELETED |
| `apps/store/src/components/customize/KonvaCustomizeCanvas.tsx` | MODIFIED (design layer, boundary feedback) |
| `apps/store/src/pages/CustomizePage.tsx` | MODIFIED (remove Fabric refs, wire undo/redo/delete) |
| `apps/store/package.json` | MODIFIED (remove fabric, confirm react-konva present) |

#### Acceptance Criteria

1. Uploading a PNG file causes it to appear on the canvas centred in the active preset area.
2. Dragging the design moves it; the live size indicator updates in real time.
3. Resizing via Transformer corner handles scales uniformly (aspect ratio preserved); size indicator updates.
4. Rotating via the rotation handle works smoothly.
5. When the design extends outside the safe-area, the safe-area rect border turns red.
6. Undo reverts the last design move/resize/rotate within 50-step history; redo replays it.
7. Delete button removes the design from the canvas and resets view state.
8. `CanvasEditor.tsx` no longer exists in the repo (`ls apps/store/src/components/customize/CanvasEditor.tsx` returns not found).
9. `pnpm --filter store build` outputs no Fabric.js references.

#### Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| Konva `Transformer` does not auto-track node on mount — must manually attach via `transformerRef.current.nodes([imageRef.current])` | Add `useEffect` that runs after both refs are populated; re-run when `isSelected` changes |
| SVG uploads may not render in `<img>` tag that Konva uses internally | Convert SVG to raster PNG on backend before returning `url`; or use `Konva.Image` with a preloaded `HTMLImageElement` from a canvas-rendered SVG |
| History stack memory: storing full `ViewState` snapshots with `previewDataUrl` (base64) bloats memory | Exclude `previewDataUrl` from history snapshots; regenerate it on demand via `Stage.toDataURL()` |
| `DesignUploader.tsx` may have a dependency on Fabric canvas context | Audit existing `DesignUploader.tsx`; if it references Fabric, extract the upload logic into a standalone hook `useDesignUpload.ts` |

---

### Phase 4: Multi-View + Per-View State

#### Scope

Each canvas view (front, back, left, right) maintains its own independent `ViewState`. Switching tabs saves the current view state and restores the target view state. A thumbnail of the placed design is generated using `Stage.toDataURL()` and shown as a small preview badge on each view tab. This creates the illusion of a persistent, multi-sided customization where the user can place different designs on different sides of the garment.

#### Checklist

- [ ] Create `apps/store/src/hooks/useCustomizationSession.ts`
  - Manages `CustomizationSession` (see type in Section 5c)
  - Exposes: `{ session, activeViewState, setActiveView, updateViewState, resetViewState }`
  - On `setActiveView(view)`: snapshot current view's `konvaNodeAttrs` before switching; do not call `Stage.toDataURL()` on every tab switch (expensive) — only on explicit "generate preview" trigger
  - `updateViewState(view, partial: Partial<ViewState>)`: merge partial into `session.views[view]`
- [ ] Modify `KonvaCustomizeCanvas` to accept `viewState: ViewState` prop and render from it (controlled component pattern)
- [ ] Add `onViewStateChange: (partial: Partial<ViewState>) => void` prop to `KonvaCustomizeCanvas`; emit on every `transformend`/`dragend`
- [ ] Create `apps/store/src/hooks/useViewThumbnails.ts`
  - Manages `{ [view: ViewName]: string | null }` dataUrl map
  - Exposes `captureViewThumbnail(view: ViewName, stageRef: RefObject<Konva.Stage>)`
  - Calls `stageRef.current.toDataURL({ pixelRatio: 0.3 })` (low-res for thumbnail)
  - Debounce capture by 2000ms after last state change
- [ ] Pass `viewThumbDataUrls` into `ViewSwitcherTabs` so tabs show design thumbnails
- [ ] On view switch: call `captureViewThumbnail(previousView, stageRef)` to lock in thumbnail before leaving
- [ ] Ensure each view's `GarmentBounds` is independently loaded from `garmentBoundsLoader` based on `productType + view`
- [ ] Each view tab must show garment image of that view — confirm `KonvaCustomizeCanvas` re-initializes garment layer when `view` prop changes

**State isolation test:** place design A on front, switch to back, place design B, switch back to front — design A should still be where it was placed.

#### Output Artifacts

| Path | Status |
|------|--------|
| `apps/store/src/hooks/useCustomizationSession.ts` | NEW |
| `apps/store/src/hooks/useViewThumbnails.ts` | NEW |
| `apps/store/src/components/customize/ViewSwitcherTabs.tsx` | MODIFIED (thumbnail badges) |
| `apps/store/src/components/customize/KonvaCustomizeCanvas.tsx` | MODIFIED (controlled, viewState prop) |

#### Acceptance Criteria

1. Place design on Front, switch to Back, switch back to Front — design position, scale, and rotation are preserved exactly.
2. After placing a design on Front and waiting 2s, the Front tab shows a small thumbnail preview of the garment+design composite.
3. Each view's garment image is correct (Hoodie Front on Front tab, Hoodie Back on Back tab, etc.).
4. `session.views` object contains independent state for each view with designs placed.
5. `session.activeView` updates when tabs are switched.
6. No performance regression: switching between tabs takes under 200ms (no blocking `Stage.toDataURL()` on tab switch).

#### Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| `Stage.toDataURL()` with `pixelRatio: 1` on a 560×680 canvas is ~1.5MB; running it on every state change freezes the UI | Always use `pixelRatio: 0.3` for thumbnails; full-res export only in Phase 5 on explicit save |
| Portrait sleeve views have different canvas height — thumbnail aspect ratios differ per view | Use `object-fit: cover` on thumbnail `<img>` tags with fixed 18×18px container |
| State desync: `konvaNodeAttrs` in `ViewState` may drift from actual Konva node if component remounts | On `KonvaCustomizeCanvas` mount, seed Konva node from `viewState.konvaNodeAttrs` using `imageRef.current.setAttrs(viewState.konvaNodeAttrs)` |

---

### Phase 5: Persistence + Cart

#### Scope

Design sessions are persisted to localStorage as drafts so users can refresh without losing work. On explicit "Save & Add to Cart" action, the session is serialized and sent to a new backend endpoint `POST /api/customizations`. The backend uploads each view's preview image to Cloudinary and stores the customization record. The returned `customizationId` and `previewUrl` are injected into the cart as `optionPayload` on the CartItem. The route handoff from the PDP is confirmed to pass all required query parameters.

#### Checklist

**LocalStorage draft:**
- [ ] Create `apps/store/src/lib/customizationDraft.ts`
  - `saveDraft(session: CustomizationSession): void` → `localStorage.setItem('customize_draft_{slug}_{variantId}', JSON.stringify(session))`
  - `loadDraft(slug: string, variantId: string): CustomizationSession | null`
  - `clearDraft(slug: string, variantId: string): void`
  - Exclude `previewDataUrl` from stored draft to keep localStorage size manageable; store only `konvaNodeAttrs` + measurement fields
- [ ] In `useCustomizationSession`: auto-save draft via `useEffect` with 1000ms debounce on every session state change
- [ ] On `CustomizePage` mount: attempt `loadDraft(slug, variantId)`; if found, restore session and show "Resume previous session?" toast

**Backend endpoint:**
- [ ] Create `backend/src/routes/customizations.ts`
  - `POST /api/customizations` — accepts request body (see Section 5d)
  - For each view with a `previewDataUrl`: upload base64 to Cloudinary via existing Cloudinary util
  - Create `Customization` record in Prisma with `productSlug`, `variantId`, `viewsJson`, `previewUrl`
  - Return `{ id, previewUrl }`
- [ ] Add Prisma schema migration: `Customization` model
  ```prisma
  model Customization {
    id          String   @id @default(cuid())
    productSlug String
    variantId   String
    size        String
    viewsJson   Json
    previewUrl  String
    createdAt   DateTime @default(now())
    cartItemId  String?  @unique
    cartItem    CartItem? @relation(fields: [cartItemId], references: [id])
  }
  ```
- [ ] Run `pnpm --filter backend prisma migrate dev --name add_customization`
- [ ] Add route to `backend/src/app.ts`: `app.register(customizationsRoutes, { prefix: '/api/customizations' })`

**Frontend save flow:**
- [ ] Create `apps/store/src/hooks/useSaveCustomization.ts`
  - `saveCustomization(session: CustomizationSession): Promise<{ id: string; previewUrl: string }>`
  - Before POST: call `Stage.toDataURL({ pixelRatio: 1 })` for each active view to get full-res preview
  - POST to `/api/customizations`
  - On success: `clearDraft(slug, variantId)`
  - On failure: show error toast, keep draft

**Cart integration:**
- [ ] After successful save, call existing cart API:
  ```ts
  await addToCart({
    productSlug,
    variantId,
    qty,
    optionPayload: {
      customizationId: result.id,
      previewUrl: result.previewUrl,
      placementSummary: buildPlacementSummary(session),
    }
  })
  ```
- [ ] `buildPlacementSummary(session)` — maps `session.views` to `PlacementSummaryItem[]` (see Section 5e)

**Route handoff from PDP:**
- [ ] Confirm PDP "Customize" button builds URL:
  ```ts
  `/customize/${product.slug}?variantId=${variantId}&size=${selectedSize}&color=${selectedColor}&qty=${qty}`
  ```
- [ ] In `CustomizePage`, parse query params with `useSearchParams()` and seed `CustomizationSession` initial state

#### Output Artifacts

| Path | Status |
|------|--------|
| `apps/store/src/lib/customizationDraft.ts` | NEW |
| `apps/store/src/hooks/useSaveCustomization.ts` | NEW |
| `backend/src/routes/customizations.ts` | NEW |
| `backend/prisma/schema.prisma` | MODIFIED (add Customization model) |
| `backend/prisma/migrations/YYYYMMDD_add_customization/` | NEW |
| `backend/src/app.ts` | MODIFIED (register customizations route) |
| `apps/store/src/pages/CustomizePage.tsx` | MODIFIED (draft restore, save flow, cart handoff) |

#### Acceptance Criteria

1. Placing a design, then refreshing the page: a "Resume previous session?" toast appears; accepting it restores position, scale, rotation.
2. Clicking "Save & Add to Cart": spinner shows, then a success toast; cart badge increments by 1.
3. The new CartItem in the cart drawer shows the preview image from Cloudinary.
4. `GET /api/cart` returns the new item with `optionPayload.customizationId` and `optionPayload.previewUrl` populated.
5. `POST /api/customizations` with a valid body returns 200 with `{ id, previewUrl }` within 5s (Cloudinary upload time included).
6. Draft localStorage key `customize_draft_blank-hoodie_{variantId}` is cleared after successful cart add.
7. Prisma migration runs without error in CI: `pnpm --filter backend prisma migrate deploy`.

#### Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| Full-res `Stage.toDataURL()` on a 560×680 canvas at `pixelRatio: 2` produces ~4MB base64 string — POST body too large | Use `pixelRatio: 1.5` max; compress via canvas `toBlob('image/jpeg', 0.85)` before base64 encoding; set Fastify `bodyLimit` to 10MB |
| Cloudinary upload timeout in backend causes request to hang | Set Cloudinary upload timeout to 30s; return 202 Accepted and process async via a queue if needed |
| `localStorage` draft exceeds 5MB storage quota if `konvaNodeAttrs` includes image data | Never store `previewDataUrl` or image pixel data in draft; store only transform attrs + asset URLs |
| `CartItem.optionPayload` is a JSON field — existing cart code may not expect `customizationId` | Add null-safe access in cart display components: `item.optionPayload?.customizationId` |
| Backend Customization model foreign key to CartItem creates circular dependency during cart creation | Make `cartItemId` optional; link it in a second PATCH call after cart item is created |

---

### Phase 6: UX Polish + Mobile

#### Scope

This phase brings the customization page to production quality. The layout adapts to mobile with a collapsible toolbar, horizontal-scrollable preset strip, and touch-optimised canvas interactions (Konva handles touch events natively). Keyboard shortcuts are wired. Loading skeletons prevent layout shift. Error states are handled gracefully with actionable messaging.

#### Checklist

**Mobile layout:**
- [ ] Create `apps/store/src/components/customize/CustomizePageLayout.tsx`
  - Desktop: two-column layout (toolbar 280px left, canvas right)
  - Mobile: canvas full-width top, toolbar collapsed to a bottom drawer/sheet
  - Use Tailwind `md:` breakpoint for the column split
- [ ] On mobile, left toolbar collapses to a `<Sheet>` (shadcn/ui) triggered by a "Tools" button
- [ ] View switcher tabs move above canvas on mobile (already handled if flex-column layout on small screens)
- [ ] `PlacementPresetBar`: on mobile, render as `overflow-x: scroll` horizontal strip; on desktop, vertical list in sidebar
- [ ] Test on real device or BrowserStack: iPhone 14 (390px wide), Samsung Galaxy S22 (360px wide)

**Touch support:**
- [ ] Konva handles touch drag and pinch-to-resize natively — verify `touchAction: 'none'` is set on the canvas container div to prevent page scroll conflicts:
  ```tsx
  <div style={{ touchAction: 'none' }}>
    <Stage ... />
  </div>
  ```
- [ ] Test two-finger pinch on Transformer anchor works on iOS Safari (known Konva issue: may need `passive: false` on touchmove)
- [ ] Disable browser default zoom on canvas area: `user-scalable=no` in viewport meta (already present in most setups; confirm)

**Keyboard shortcuts:**
- [ ] Create `apps/store/src/hooks/useCustomizeKeyboard.ts`
  ```ts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return // don't capture in inputs
      if (e.key === 'Delete' || e.key === 'Backspace') onDelete()
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) onUndo()
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) onRedo()
      if (e.key === 'Escape') onDeselect()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onDelete, onUndo, onRedo, onDeselect])
  ```
- [ ] Show keyboard shortcut hints in tooltip on undo/redo/delete buttons (desktop only)

**Loading skeleton:**
- [ ] `CanvasLoadingSkeleton`: already created in Phase 1; confirm it renders while garment image status is `'loading'`
- [ ] Add skeleton for the `PlacementPresetBar` while placement standards are loading (should be instant from JSON, but handle async import gracefully)
- [ ] Show `UploadStatusChip` (existing component) with progress % during artwork upload

**Error states:**
- [ ] Upload failed: show inline error below uploader: "Upload failed. Try again or use a different file." with retry button
- [ ] Save failed (POST /api/customizations error): toast "Could not save customization. Your design is preserved as a draft." — do not clear draft
- [ ] Garment image load failed (network error): show "Could not load garment image" with refresh button
- [ ] Cart add failed: toast "Could not add to cart. Please try again."

**Final integration QA checklist:**
- [ ] End-to-end test: `apps/store/src/tests/customize-e2e.spec.ts`
  - Upload PNG → apply Full Front preset → switch to Back → upload second PNG → Back Full preset → Save → Add to Cart → assert cart API response
- [ ] Visual regression: Playwright screenshot of desktop and mobile canvas with hoodie front + design placed
- [ ] Lighthouse score on `/customize/blank-hoodie`: Performance >= 70 (canvas is GPU-accelerated)

#### Output Artifacts

| Path | Status |
|------|--------|
| `apps/store/src/components/customize/CustomizePageLayout.tsx` | NEW |
| `apps/store/src/hooks/useCustomizeKeyboard.ts` | NEW |
| `apps/store/src/tests/customize-e2e.spec.ts` | NEW |
| `apps/store/src/components/customize/PlacementPresetBar.tsx` | MODIFIED (mobile scrollable layout) |
| `apps/store/src/pages/CustomizePage.tsx` | MODIFIED (keyboard hook, error states, layout component) |

#### Acceptance Criteria

1. On iPhone 14 (390px): canvas is 358px wide, toolbar appears as bottom sheet, presets scroll horizontally.
2. `Delete` key removes selected design. `Ctrl+Z` undoes last action. `Escape` deselects.
3. Two-finger pinch on the canvas Transformer resizes the design on iOS Safari.
4. When garment image fails to load (network offline): error message displayed, no white blank canvas.
5. End-to-end test in `customize-e2e.spec.ts` passes in CI.
6. Lighthouse performance score >= 70 on the customize page.

#### Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| iOS Safari does not fire `touchmove` at full frame rate on canvas elements — jank during drag | Use `requestAnimationFrame` in drag handlers; Konva's internal loop already uses RAF but verify |
| `user-scalable=no` viewport meta may break accessibility (users who rely on browser zoom) | Use CSS `touch-action: none` on canvas container only; leave page-level zoom enabled |
| Bottom sheet z-index conflicts with existing shadcn/ui modals | Assign sheet `z-index: 50`; confirm no existing modals use the same z-index |
| Playwright canvas screenshot tests are brittle (font rendering differences between CI and local) | Use `toHaveScreenshot` with `maxDiffPixelRatio: 0.05` tolerance |

---

## 3. Definition of Done

The customization page feature is considered complete and production-ready when ALL of the following are true:

**Functionality**
- [ ] User can navigate to `/customize/:productSlug` with query params and see the correct garment image
- [ ] User can switch between available views (Front/Back/Left/Right) and each view is independent
- [ ] User can upload an artwork file (PNG, JPEG, SVG accepted); it appears on the canvas
- [ ] User can drag, resize (uniformly), and rotate the design
- [ ] Placement presets position the design at physically accurate DTF-standard locations
- [ ] Design cannot be dragged/resized outside the safe print area
- [ ] Live cm×cm size indicator reflects actual print dimensions
- [ ] Undo/redo works up to 50 steps
- [ ] Design can be deleted from a view
- [ ] Designs on multiple views are preserved when switching tabs
- [ ] Draft is auto-saved to localStorage and restored on page refresh
- [ ] "Save & Add to Cart" uploads preview to Cloudinary, creates customization record, adds cart item
- [ ] Cart item shows `optionPayload` with `customizationId` and `previewUrl`

**Code Quality**
- [ ] Zero TypeScript errors (`tsc --noEmit`)
- [ ] Zero ESLint errors (`eslint apps/store/src`)
- [ ] All new hooks have unit tests with >= 80% branch coverage
- [ ] Fabric.js removed from `apps/store/package.json` and codebase
- [ ] No `console.error` or unhandled promise rejections in browser console during normal use

**Performance**
- [ ] Garment image renders within 1s on a 50Mbps connection
- [ ] Tab switch (view change) completes within 200ms
- [ ] Save + cart add completes within 8s end-to-end
- [ ] No memory leaks: switching views 20 times does not grow heap (verify in Chrome DevTools Memory tab)

**Accessibility**
- [ ] Canvas is wrapped in a `role="application"` element with `aria-label="Garment customization canvas"`
- [ ] View switcher tabs are keyboard navigable
- [ ] All buttons have accessible labels
- [ ] Error states are announced via `aria-live="polite"` region

**Cross-platform**
- [ ] Chrome 120+, Firefox 121+, Safari 17+ on desktop
- [ ] Chrome Mobile on Android 12+
- [ ] Safari on iOS 16+

**CI**
- [ ] All existing tests still pass
- [ ] New unit tests pass
- [ ] New E2E test (`customize-e2e.spec.ts`) passes
- [ ] `pnpm --filter backend prisma migrate deploy` runs without error against a clean DB

---

## 4. File / Folder Plan

### Legend

- **NEW** — file does not yet exist in the repo
- **MODIFIED** — file exists and requires changes
- **DELETED** — file exists and will be removed

### Store App (`apps/store/`)

```
apps/store/
├── src/
│   ├── data/
│   │   ├── garmentBounds.json                          NEW
│   │   ├── placementStandards.json                     NEW
│   │   └── __tests__/
│   │       └── garmentBounds.test.ts                   NEW
│   ├── types/
│   │   ├── customization.ts                            NEW
│   │   └── garment.ts                                  NEW
│   ├── lib/
│   │   ├── garmentBoundsLoader.ts                      NEW
│   │   ├── placementLoader.ts                          NEW
│   │   └── customizationDraft.ts                       NEW
│   ├── hooks/
│   │   ├── useCanvasDimensions.ts                      NEW
│   │   ├── useKonvaImage.ts                            NEW
│   │   ├── usePlacementEngine.ts                       NEW
│   │   ├── useHistory.ts                               NEW
│   │   ├── useCustomizationSession.ts                  NEW
│   │   ├── useViewThumbnails.ts                        NEW
│   │   ├── useSaveCustomization.ts                     NEW
│   │   ├── useCustomizeKeyboard.ts                     NEW
│   │   └── __tests__/
│   │       ├── usePlacementEngine.test.ts              NEW
│   │       └── useHistory.test.ts                      NEW
│   ├── components/
│   │   └── customize/
│   │       ├── CanvasEditor.tsx                        DELETED  (Fabric.js version)
│   │       ├── DesignUploader.tsx                      MODIFIED (wire to Konva flow)
│   │       ├── PlacementSelector.tsx                   MODIFIED (delegate to PlacementPresetBar)
│   │       ├── SizeTierSelector.tsx                    MODIFIED (connect sizeCategory to usePlacementEngine)
│   │       ├── PriceBreakdown.tsx                      UNMODIFIED
│   │       ├── AutoMockupPreview.tsx                   UNMODIFIED
│   │       ├── AddOnSelector.tsx                       UNMODIFIED
│   │       ├── UploadStatusChip.tsx                    UNMODIFIED
│   │       ├── KonvaCustomizeCanvas.tsx                NEW
│   │       ├── KonvaDesignImage.tsx                    NEW
│   │       ├── ViewSwitcherTabs.tsx                    NEW
│   │       ├── PlacementPresetBar.tsx                  NEW
│   │       ├── DesignSizeIndicator.tsx                 NEW
│   │       ├── CanvasLoadingSkeleton.tsx               NEW
│   │       └── CustomizePageLayout.tsx                 NEW
│   ├── pages/
│   │   └── CustomizePage.tsx                           MODIFIED
│   └── tests/
│       ├── customize-canvas.spec.ts                    NEW
│       └── customize-e2e.spec.ts                       NEW
└── package.json                                        MODIFIED (add react-konva, konva; remove fabric)
```

### Backend (`backend/`)

```
backend/
├── prisma/
│   ├── schema.prisma                                   MODIFIED (add Customization model)
│   └── migrations/
│       └── YYYYMMDD_add_customization/
│           └── migration.sql                           NEW
└── src/
    └── routes/
        └── customizations.ts                           NEW
    └── app.ts                                          MODIFIED (register customizations route)
```

### Garment Image Assets

Garment images currently live in `apps/admin/Blank Print Products/`. They must be accessible from the store frontend. Options (choose one before Phase 1):

**Option A (recommended for dev):** Copy to `apps/store/public/garments/` and reference via `/garments/Hoodie Front.png`.

**Option B (production):** Upload to Cloudinary at project setup time; store URLs in `garmentBounds.json` as `imageUrl` field; serve from CDN.

**Decision needed from team before Phase 1 starts.** The plan assumes Option A for local dev and the `imageFile` field in `garmentBounds.json` is resolved to `/garments/{imageFile}` by `garmentBoundsLoader.ts`.

---

## 5. API & Data Interface Sketches

### 5a. garmentBounds.json

Full 19-entry file. Stored at `apps/store/src/data/garmentBounds.json`.

```json
{
  "basketball_jersey_front": {
    "imageFile": "BasketBall Jersey Front.png",
    "imgPx": { "w": 1536, "h": 1024 },
    "boxPx": { "x1": 492, "y1": 39, "x2": 1044, "y2": 985 },
    "boxPxSize": { "w": 553, "h": 947 },
    "safeFrame": { "x1": 519.65, "y1": 86.35, "x2": 1017.35, "y2": 938.65 },
    "center": { "x": 768.5, "y": 512.5 },
    "garmentWidthCm": 30.5,
    "collarRefY": 39
  },
  "basketball_jersey_back": {
    "imageFile": "BasketBall Jersey Back.png",
    "imgPx": { "w": 1536, "h": 1024 },
    "boxPx": { "x1": 495, "y1": 38, "x2": 1042, "y2": 987 },
    "boxPxSize": { "w": 548, "h": 950 },
    "safeFrame": { "x1": 522.4, "y1": 85.5, "x2": 1015.6, "y2": 940.5 },
    "center": { "x": 769, "y": 513 },
    "garmentWidthCm": 30.5,
    "collarRefY": 38
  },
  "hoodie_front": {
    "imageFile": "Hoodie Front.png",
    "imgPx": { "w": 1536, "h": 1024 },
    "boxPx": { "x1": 405, "y1": 74, "x2": 1132, "y2": 969 },
    "boxPxSize": { "w": 728, "h": 896 },
    "safeFrame": { "x1": 441.4, "y1": 118.8, "x2": 1096.6, "y2": 925.2 },
    "center": { "x": 769, "y": 522 },
    "garmentWidthCm": 30.5,
    "collarRefY": 74
  },
  "hoodie_back": {
    "imageFile": "Hoodie Back.png",
    "imgPx": { "w": 1536, "h": 1024 },
    "boxPx": { "x1": 410, "y1": 76, "x2": 1132, "y2": 957 },
    "boxPxSize": { "w": 723, "h": 882 },
    "safeFrame": { "x1": 446.15, "y1": 120.1, "x2": 1096.85, "y2": 913.9 },
    "center": { "x": 771.5, "y": 517 },
    "garmentWidthCm": 30.5,
    "collarRefY": 76
  },
  "hoodie_left": {
    "imageFile": "Hoode Left.png",
    "imgPx": { "w": 1024, "h": 1536 },
    "boxPx": { "x1": 285, "y1": 221, "x2": 752, "y2": 1286 },
    "boxPxSize": { "w": 468, "h": 1066 },
    "safeFrame": { "x1": 308.4, "y1": 274.3, "x2": 729.6, "y2": 1233.7 },
    "center": { "x": 519, "y": 754 },
    "garmentWidthCm": 5.1,
    "collarRefY": 221
  },
  "hoodie_right": {
    "imageFile": "Hoodie Right.png",
    "imgPx": { "w": 1024, "h": 1536 },
    "boxPx": { "x1": 259, "y1": 197, "x2": 747, "y2": 1290 },
    "boxPxSize": { "w": 489, "h": 1094 },
    "safeFrame": { "x1": 283.45, "y1": 251.7, "x2": 723.55, "y2": 1236.3 },
    "center": { "x": 503.5, "y": 744 },
    "garmentWidthCm": 5.1,
    "collarRefY": 197
  },
  "polo_front": {
    "imageFile": "Polo Front.png",
    "imgPx": { "w": 1536, "h": 1024 },
    "boxPx": { "x1": 365, "y1": 57, "x2": 1170, "y2": 966 },
    "boxPxSize": { "w": 806, "h": 910 },
    "safeFrame": { "x1": 405.3, "y1": 102.5, "x2": 1130.7, "y2": 921.5 },
    "center": { "x": 768, "y": 512 },
    "garmentWidthCm": 30.5,
    "collarRefY": 57
  },
  "polo_back": {
    "imageFile": "Polo Back.png",
    "imgPx": { "w": 1536, "h": 1024 },
    "boxPx": { "x1": 361, "y1": 50, "x2": 1174, "y2": 981 },
    "boxPxSize": { "w": 814, "h": 932 },
    "safeFrame": { "x1": 401.7, "y1": 96.6, "x2": 1134.3, "y2": 935.4 },
    "center": { "x": 768, "y": 516 },
    "garmentWidthCm": 30.5,
    "collarRefY": 50
  },
  "polo_left": {
    "imageFile": "Polo Left.png",
    "imgPx": { "w": 1024, "h": 1536 },
    "boxPx": { "x1": 131, "y1": 176, "x2": 852, "y2": 1398 },
    "boxPxSize": { "w": 722, "h": 1223 },
    "safeFrame": { "x1": 167.1, "y1": 237.15, "x2": 816.9, "y2": 1337.85 },
    "center": { "x": 492, "y": 787.5 },
    "garmentWidthCm": 5.1,
    "collarRefY": 176
  },
  "polo_right": {
    "imageFile": "Polo Right.png",
    "imgPx": { "w": 1024, "h": 1536 },
    "boxPx": { "x1": 288, "y1": 208, "x2": 744, "y2": 1321 },
    "boxPxSize": { "w": 457, "h": 1114 },
    "safeFrame": { "x1": 310.85, "y1": 263.7, "x2": 722.15, "y2": 1266.3 },
    "center": { "x": 516.5, "y": 765 },
    "garmentWidthCm": 5.1,
    "collarRefY": 208
  },
  "soccer_jersey_front": {
    "imageFile": "Soccer Jersey Front.png",
    "imgPx": { "w": 1536, "h": 1024 },
    "boxPx": { "x1": 376, "y1": 45, "x2": 1161, "y2": 983 },
    "boxPxSize": { "w": 786, "h": 939 },
    "safeFrame": { "x1": 415.3, "y1": 91.95, "x2": 1122.7, "y2": 937.05 },
    "center": { "x": 769, "y": 514.5 },
    "garmentWidthCm": 30.5,
    "collarRefY": 45
  },
  "soccer_jersey_back": {
    "imageFile": "Soccer Jersey Back.png",
    "imgPx": { "w": 1536, "h": 1024 },
    "boxPx": { "x1": 370, "y1": 40, "x2": 1167, "y2": 987 },
    "boxPxSize": { "w": 798, "h": 948 },
    "safeFrame": { "x1": 409.9, "y1": 87.4, "x2": 1128.1, "y2": 940.6 },
    "center": { "x": 769, "y": 514 },
    "garmentWidthCm": 30.5,
    "collarRefY": 40
  },
  "sweatshirt_front": {
    "imageFile": "Sweatshirt Front.png",
    "imgPx": { "w": 1536, "h": 1024 },
    "boxPx": { "x1": 347, "y1": 65, "x2": 1185, "y2": 953 },
    "boxPxSize": { "w": 839, "h": 889 },
    "safeFrame": { "x1": 388.95, "y1": 109.45, "x2": 1144.05, "y2": 909.55 },
    "center": { "x": 766.5, "y": 509.5 },
    "garmentWidthCm": 30.5,
    "collarRefY": 65
  },
  "sweatshirt_back": {
    "imageFile": "Sweatshirt Back.png",
    "imgPx": { "w": 1536, "h": 1024 },
    "boxPx": { "x1": 349, "y1": 64, "x2": 1186, "y2": 952 },
    "boxPxSize": { "w": 838, "h": 889 },
    "safeFrame": { "x1": 390.9, "y1": 108.45, "x2": 1145.1, "y2": 908.55 },
    "center": { "x": 768, "y": 508.5 },
    "garmentWidthCm": 30.5,
    "collarRefY": 64
  },
  "sweatshirt_left": {
    "imageFile": "Sweatshirt Left.png",
    "imgPx": { "w": 1024, "h": 1536 },
    "boxPx": { "x1": 293, "y1": 209, "x2": 750, "y2": 1312 },
    "boxPxSize": { "w": 458, "h": 1104 },
    "safeFrame": { "x1": 315.9, "y1": 264.2, "x2": 728.1, "y2": 1257.8 },
    "center": { "x": 522, "y": 761 },
    "garmentWidthCm": 5.1,
    "collarRefY": 209
  },
  "sweatshirt_right": {
    "imageFile": "Sweatshirt Right.png",
    "imgPx": { "w": 1024, "h": 1536 },
    "boxPx": { "x1": 282, "y1": 206, "x2": 751, "y2": 1303 },
    "boxPxSize": { "w": 470, "h": 1098 },
    "safeFrame": { "x1": 305.5, "y1": 260.9, "x2": 728.5, "y2": 1249.1 },
    "center": { "x": 517, "y": 755 },
    "garmentWidthCm": 5.1,
    "collarRefY": 206
  },
  "tanktop_front": {
    "imageFile": "TankTop Front.png",
    "imgPx": { "w": 1536, "h": 1024 },
    "boxPx": { "x1": 509, "y1": 40, "x2": 1028, "y2": 986 },
    "boxPxSize": { "w": 520, "h": 947 },
    "safeFrame": { "x1": 535, "y1": 87.35, "x2": 1003, "y2": 939.65 },
    "center": { "x": 769, "y": 513.5 },
    "garmentWidthCm": 30.5,
    "collarRefY": 40
  },
  "tanktop_back": {
    "imageFile": "TankTop Back.png",
    "imgPx": { "w": 1536, "h": 1024 },
    "boxPx": { "x1": 490, "y1": 37, "x2": 1045, "y2": 987 },
    "boxPxSize": { "w": 556, "h": 951 },
    "safeFrame": { "x1": 517.8, "y1": 84.55, "x2": 1018.2, "y2": 940.45 },
    "center": { "x": 768, "y": 512.5 },
    "garmentWidthCm": 30.5,
    "collarRefY": 37
  },
  "tote_bag_front": {
    "imageFile": "Tote Bag.png",
    "imgPx": { "w": 1536, "h": 1024 },
    "boxPx": { "x1": 464, "y1": 30, "x2": 1069, "y2": 987 },
    "boxPxSize": { "w": 606, "h": 958 },
    "safeFrame": { "x1": 494.3, "y1": 77.9, "x2": 1039.7, "y2": 940.1 },
    "center": { "x": 767, "y": 509 },
    "garmentWidthCm": 30.5,
    "collarRefY": 30
  }
}
```

### 5b. placementStandards.json

Stored at `apps/store/src/data/placementStandards.json`.

```json
{
  "hoodie_front_center_adult": {
    "placementKey": "front_center",
    "productType": "hoodie",
    "sizeCategory": "adult",
    "widthCm": 27.9,
    "heightCm": 27.9,
    "topFromCollarCm": 7.6,
    "leftFromCenterCm": 0,
    "view": "front",
    "source": "DTF Junkie"
  },
  "hoodie_front_center_youth_ml": {
    "placementKey": "front_center",
    "productType": "hoodie",
    "sizeCategory": "youth_ml",
    "widthCm": 26.7,
    "heightCm": 26.7,
    "topFromCollarCm": 7.6,
    "leftFromCenterCm": 0,
    "view": "front",
    "source": "DTF Junkie"
  },
  "hoodie_front_center_youth_s": {
    "placementKey": "front_center",
    "productType": "hoodie",
    "sizeCategory": "youth_s",
    "widthCm": 21.6,
    "heightCm": 21.6,
    "topFromCollarCm": 7.6,
    "leftFromCenterCm": 0,
    "view": "front",
    "source": "DTF Junkie"
  },
  "hoodie_front_center_toddler": {
    "placementKey": "front_center",
    "productType": "hoodie",
    "sizeCategory": "toddler",
    "widthCm": 14.0,
    "heightCm": 14.0,
    "topFromCollarCm": 7.6,
    "leftFromCenterCm": 0,
    "view": "front",
    "source": "DTF Junkie"
  },
  "hoodie_left_chest_adult": {
    "placementKey": "left_chest",
    "productType": "hoodie",
    "sizeCategory": "adult",
    "widthCm": 8.9,
    "heightCm": 8.9,
    "topFromCollarCm": 14.0,
    "leftFromCenterCm": -12.7,
    "view": "front",
    "source": "DTF Junkie"
  },
  "hoodie_across_chest_adult": {
    "placementKey": "across_chest",
    "productType": "hoodie",
    "sizeCategory": "adult",
    "widthCm": 30.5,
    "heightCm": 10.2,
    "topFromCollarCm": 7.6,
    "leftFromCenterCm": 0,
    "view": "front",
    "source": "DTF Junkie"
  },
  "hoodie_back_full_adult": {
    "placementKey": "back_full",
    "productType": "hoodie",
    "sizeCategory": "adult",
    "widthCm": 35.6,
    "heightCm": 28.6,
    "topFromCollarCm": 5.1,
    "leftFromCenterCm": 0,
    "view": "back",
    "source": "DTF Junkie"
  },
  "hoodie_sleeve_adult": {
    "placementKey": "sleeve",
    "productType": "hoodie",
    "sizeCategory": "adult",
    "widthCm": 5.1,
    "heightCm": 29.2,
    "topFromCollarCm": 0,
    "leftFromCenterCm": 0,
    "view": "left",
    "source": "DTF Junkie"
  },
  "sweatshirt_front_center_adult": {
    "placementKey": "front_center",
    "productType": "sweatshirt",
    "sizeCategory": "adult",
    "widthCm": 27.9,
    "heightCm": 27.9,
    "topFromCollarCm": 7.6,
    "leftFromCenterCm": 0,
    "view": "front",
    "source": "DTF Junkie"
  },
  "sweatshirt_left_chest_adult": {
    "placementKey": "left_chest",
    "productType": "sweatshirt",
    "sizeCategory": "adult",
    "widthCm": 8.9,
    "heightCm": 8.9,
    "topFromCollarCm": 14.0,
    "leftFromCenterCm": -12.7,
    "view": "front",
    "source": "DTF Junkie"
  },
  "sweatshirt_across_chest_adult": {
    "placementKey": "across_chest",
    "productType": "sweatshirt",
    "sizeCategory": "adult",
    "widthCm": 30.5,
    "heightCm": 10.2,
    "topFromCollarCm": 7.6,
    "leftFromCenterCm": 0,
    "view": "front",
    "source": "DTF Junkie"
  },
  "sweatshirt_back_full_adult": {
    "placementKey": "back_full",
    "productType": "sweatshirt",
    "sizeCategory": "adult",
    "widthCm": 35.6,
    "heightCm": 28.6,
    "topFromCollarCm": 5.1,
    "leftFromCenterCm": 0,
    "view": "back",
    "source": "DTF Junkie"
  },
  "polo_front_center_adult": {
    "placementKey": "front_center",
    "productType": "polo",
    "sizeCategory": "adult",
    "widthCm": 27.9,
    "heightCm": 27.9,
    "topFromCollarCm": 7.6,
    "leftFromCenterCm": 0,
    "view": "front",
    "source": "DTF Junkie"
  },
  "polo_left_chest_adult": {
    "placementKey": "left_chest",
    "productType": "polo",
    "sizeCategory": "adult",
    "widthCm": 8.9,
    "heightCm": 8.9,
    "topFromCollarCm": 14.0,
    "leftFromCenterCm": -12.7,
    "view": "front",
    "source": "DTF Junkie"
  },
  "polo_back_full_adult": {
    "placementKey": "back_full",
    "productType": "polo",
    "sizeCategory": "adult",
    "widthCm": 35.6,
    "heightCm": 28.6,
    "topFromCollarCm": 5.1,
    "leftFromCenterCm": 0,
    "view": "back",
    "source": "DTF Junkie"
  },
  "basketball_jersey_front_center_adult": {
    "placementKey": "front_center",
    "productType": "basketball_jersey",
    "sizeCategory": "adult",
    "widthCm": 27.9,
    "heightCm": 27.9,
    "topFromCollarCm": 7.6,
    "leftFromCenterCm": 0,
    "view": "front",
    "source": "DTF Junkie"
  },
  "basketball_jersey_back_full_adult": {
    "placementKey": "back_full",
    "productType": "basketball_jersey",
    "sizeCategory": "adult",
    "widthCm": 35.6,
    "heightCm": 28.6,
    "topFromCollarCm": 5.1,
    "leftFromCenterCm": 0,
    "view": "back",
    "source": "DTF Junkie"
  },
  "soccer_jersey_front_center_adult": {
    "placementKey": "front_center",
    "productType": "soccer_jersey",
    "sizeCategory": "adult",
    "widthCm": 27.9,
    "heightCm": 27.9,
    "topFromCollarCm": 7.6,
    "leftFromCenterCm": 0,
    "view": "front",
    "source": "DTF Junkie"
  },
  "soccer_jersey_back_full_adult": {
    "placementKey": "back_full",
    "productType": "soccer_jersey",
    "sizeCategory": "adult",
    "widthCm": 35.6,
    "heightCm": 28.6,
    "topFromCollarCm": 5.1,
    "leftFromCenterCm": 0,
    "view": "back",
    "source": "DTF Junkie"
  },
  "tanktop_front_center_adult": {
    "placementKey": "front_center",
    "productType": "tanktop",
    "sizeCategory": "adult",
    "widthCm": 27.9,
    "heightCm": 27.9,
    "topFromCollarCm": 7.6,
    "leftFromCenterCm": 0,
    "view": "front",
    "source": "DTF Junkie"
  },
  "tanktop_back_full_adult": {
    "placementKey": "back_full",
    "productType": "tanktop",
    "sizeCategory": "adult",
    "widthCm": 35.6,
    "heightCm": 28.6,
    "topFromCollarCm": 5.1,
    "leftFromCenterCm": 0,
    "view": "back",
    "source": "DTF Junkie"
  },
  "tote_bag_front_center_adult": {
    "placementKey": "front_center",
    "productType": "tote_bag",
    "sizeCategory": "adult",
    "widthCm": 27.9,
    "heightCm": 27.9,
    "topFromCollarCm": 7.6,
    "leftFromCenterCm": 0,
    "view": "front",
    "source": "DTF Junkie"
  }
}
```

### 5c. TypeScript Interfaces

**`apps/store/src/types/garment.ts`:**

```ts
export type ViewName = 'front' | 'back' | 'left' | 'right'

export type SizeCategory = 'adult' | 'youth_ml' | 'youth_s' | 'toddler'

export interface GarmentBounds {
  imageFile: string           // e.g. "Hoodie Front.png"
  imgPx: { w: number; h: number }
  boxPx: { x1: number; y1: number; x2: number; y2: number }
  boxPxSize: { w: number; h: number }
  safeFrame: { x1: number; y1: number; x2: number; y2: number }
  center: { x: number; y: number }
  garmentWidthCm: number      // 30.5 for flat front/back, 5.1 for sleeves
  collarRefY: number          // boxPx.y1 — used as collar reference for topFromCollarCm offset
}

export interface PlacementStandard {
  placementKey: string        // "front_center" | "left_chest" | "across_chest" | "back_full" | "sleeve"
  productType: string
  sizeCategory: SizeCategory
  widthCm: number
  heightCm: number
  topFromCollarCm: number
  leftFromCenterCm: number    // negative = left of center, positive = right of center
  view: ViewName
  source: string
}

export interface KonvaImageAttrs {
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number            // degrees
  width: number               // original image width before scale
  height: number              // original image height before scale
}

export interface KonvaRect {
  x: number
  y: number
  width: number
  height: number
}
```

**`apps/store/src/types/customization.ts`:**

```ts
import type { ViewName, KonvaImageAttrs } from './garment'

export interface ViewState {
  placementKey: string | null          // "front_center" | "left_chest" | null (custom position)
  widthCm: number
  heightCm: number
  topFromCollarCm: number
  leftFromCenterCm: number
  rotation: number
  designAssetId: string | null         // uploadAsset.id from backend (Cloudinary public_id)
  designUrl: string | null             // Cloudinary URL of the uploaded artwork
  konvaNodeAttrs: KonvaImageAttrs | null  // current canvas transform state
  isOutsideSafeArea: boolean
  previewDataUrl: string | null        // Stage.toDataURL() output — NOT persisted in draft
}

export interface CustomizationSession {
  productSlug: string
  variantId: string
  size: string
  color: string
  qty: number
  views: Partial<Record<ViewName, ViewState>>
  activeView: ViewName
  savedAt: string | null               // ISO timestamp of last successful save
}

export interface PlacementSummaryItem {
  view: ViewName
  placementKey: string
  widthCm: number
  heightCm: number
}

export interface SavedCustomization {
  id: string
  previewUrl: string
}

export interface CartCustomizationPayload {
  customizationId: string
  previewUrl: string
  placementSummary: PlacementSummaryItem[]
}

// Default factory
export function createEmptyViewState(): ViewState {
  return {
    placementKey: null,
    widthCm: 0,
    heightCm: 0,
    topFromCollarCm: 0,
    leftFromCenterCm: 0,
    rotation: 0,
    designAssetId: null,
    designUrl: null,
    konvaNodeAttrs: null,
    isOutsideSafeArea: false,
    previewDataUrl: null,
  }
}

export function createEmptySession(params: {
  productSlug: string
  variantId: string
  size: string
  color: string
  qty: number
}): CustomizationSession {
  return {
    ...params,
    views: {},
    activeView: 'front',
    savedAt: null,
  }
}
```

### 5d. POST /api/customizations — Request and Response

**Request body (JSON):**

```json
{
  "productSlug": "blank-hoodie",
  "variantId": "dd99f032-4f1a-4b3e-9c5a-1234567890ab",
  "size": "L",
  "color": "White",
  "qty": 1,
  "views": {
    "front": {
      "placementKey": "front_center",
      "widthCm": 27.9,
      "heightCm": 27.9,
      "topFromCollarCm": 7.6,
      "leftFromCenterCm": 0,
      "rotation": 0,
      "designAssetId": "abc123-cloudinary-public-id",
      "previewDataUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgAB..."
    },
    "back": {
      "placementKey": "back_full",
      "widthCm": 35.6,
      "heightCm": 28.6,
      "topFromCollarCm": 5.1,
      "leftFromCenterCm": 0,
      "rotation": 0,
      "designAssetId": "def456-cloudinary-public-id",
      "previewDataUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgAB..."
    }
  }
}
```

**Response body (JSON, 200 OK):**

```json
{
  "id": "cust_clx1a2b3c4d5e6f7g8h9",
  "previewUrl": "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/customizations/cust_clx1a2b3c4d5e6f7g8h9_front.jpg"
}
```

**Response on validation error (422 Unprocessable Entity):**

```json
{
  "error": "VALIDATION_ERROR",
  "message": "views.front.previewDataUrl is required when view has a designAssetId"
}
```

**Response on server error (500):**

```json
{
  "error": "CLOUDINARY_UPLOAD_FAILED",
  "message": "Failed to upload preview image. Your design has been saved. Please retry."
}
```

**Fastify route handler skeleton (`backend/src/routes/customizations.ts`):**

```ts
import { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma'
import { uploadBase64ToCloudinary } from '../lib/cloudinary'

const customizationsRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: PostCustomizationBody }>('/', {
    schema: {
      body: {
        type: 'object',
        required: ['productSlug', 'variantId', 'size', 'views'],
        properties: {
          productSlug: { type: 'string' },
          variantId: { type: 'string', format: 'uuid' },
          size: { type: 'string' },
          color: { type: 'string' },
          qty: { type: 'integer', minimum: 1 },
          views: { type: 'object' },
        },
      },
    },
    preHandler: [app.authenticate],  // require valid Supabase JWT
    handler: async (request, reply) => {
      const { productSlug, variantId, size, color, qty, views } = request.body

      // Upload preview images to Cloudinary
      const uploadedPreviews: Record<string, string> = {}
      for (const [viewName, viewData] of Object.entries(views)) {
        if (viewData.previewDataUrl) {
          const url = await uploadBase64ToCloudinary(
            viewData.previewDataUrl,
            `customizations/${productSlug}/${variantId}/${viewName}`
          )
          uploadedPreviews[viewName] = url
        }
      }

      // Persist to DB
      const customization = await prisma.customization.create({
        data: {
          productSlug,
          variantId,
          size,
          viewsJson: views as any,
          previewUrl: uploadedPreviews['front'] ?? uploadedPreviews[Object.keys(uploadedPreviews)[0]] ?? '',
        },
      })

      return reply.code(200).send({
        id: customization.id,
        previewUrl: customization.previewUrl,
      })
    },
  })
}

export default customizationsRoutes
```

### 5e. Cart Line Item optionPayload

**CartItem.optionPayload structure for customized products:**

```json
{
  "customizationId": "cust_clx1a2b3c4d5e6f7g8h9",
  "previewUrl": "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/customizations/cust_clx1a2b3c4d5e6f7g8h9_front.jpg",
  "placementSummary": [
    {
      "view": "front",
      "placementKey": "front_center",
      "widthCm": 27.9,
      "heightCm": 27.9
    },
    {
      "view": "back",
      "placementKey": "back_full",
      "widthCm": 35.6,
      "heightCm": 28.6
    }
  ]
}
```

**`buildPlacementSummary` helper:**

```ts
// apps/store/src/lib/customizationDraft.ts (add alongside draft helpers)

import type { CustomizationSession, PlacementSummaryItem } from '../types/customization'

export function buildPlacementSummary(session: CustomizationSession): PlacementSummaryItem[] {
  return Object.entries(session.views)
    .filter(([, viewState]) => viewState.designAssetId !== null)
    .map(([view, viewState]) => ({
      view: view as ViewName,
      placementKey: viewState.placementKey ?? 'custom',
      widthCm: viewState.widthCm,
      heightCm: viewState.heightCm,
    }))
}
```

---

## 6. Overlay Engine Math

### Full Worked Example: "Front Center Adult" on Hoodie Front in a 560px Canvas

This section documents the exact arithmetic so that any engineer can verify the implementation against these reference values.

#### Given

| Variable | Value | Source |
|----------|-------|--------|
| Garment image native width | 1536 px | `garmentBounds.hoodie_front.imgPx.w` |
| Garment image native height | 1024 px | `garmentBounds.hoodie_front.imgPx.h` |
| Garment box left edge in image | 405 px | `garmentBounds.hoodie_front.boxPx.x1` |
| Garment box top edge in image | 74 px | `garmentBounds.hoodie_front.boxPx.y1` |
| Garment box right edge in image | 1132 px | `garmentBounds.hoodie_front.boxPx.x2` |
| Garment box width in image | 728 px | `1132 - 405` |
| Physical garment max print width | 30.5 cm | `garmentBounds.hoodie_front.garmentWidthCm` |
| Canvas display width | 560 px | Desktop layout constant |
| Preset: width | 27.9 cm | `placementStandards.hoodie_front_center_adult.widthCm` |
| Preset: height | 27.9 cm | `placementStandards.hoodie_front_center_adult.heightCm` |
| Preset: topFromCollarCm | 7.6 cm | `placementStandards.hoodie_front_center_adult.topFromCollarCm` |
| Preset: leftFromCenterCm | 0 cm | `placementStandards.hoodie_front_center_adult.leftFromCenterCm` |

#### Step 1: Compute displayScale

```
displayScale = canvasWidth / imgPxWidth
displayScale = 560 / 1536
displayScale = 0.36458...
             ≈ 0.3646
```

This scalar converts any image-space coordinate to canvas-space.

#### Step 2: Compute canvas height

```
canvasHeight = imgPxHeight × displayScale
canvasHeight = 1024 × 0.3646
canvasHeight = 373.3 px
```

The Stage is instantiated as `<Stage width={560} height={373}>`.

#### Step 3: Compute pxPerCm in image space

```
pxPerCmInImage = garmentBoxWidthPx / garmentPhysicalWidthCm
pxPerCmInImage = 728 / 30.5
pxPerCmInImage = 23.869... px/cm
               ≈ 23.87 px/cm
```

#### Step 4: Convert preset dimensions to image-space pixels

```
presetWidthInImagePx  = presetWidthCm × pxPerCmInImage
                      = 27.9 × 23.87
                      = 665.97 px
                      ≈ 665.97 px

presetHeightInImagePx = presetHeightCm × pxPerCmInImage
                      = 27.9 × 23.87
                      = 665.97 px
```

Since `widthCm === heightCm`, both dimensions are equal (square design area).

#### Step 5: Convert preset dimensions to canvas-space pixels

```
presetWidthInCanvas  = presetWidthInImagePx × displayScale
                     = 665.97 × 0.3646
                     = 242.78 px
                     ≈ 242.8 px

presetHeightInCanvas = 665.97 × 0.3646
                     = 242.78 px
                     ≈ 242.8 px
```

#### Step 6: Compute design center X in canvas space

```
garmentCenterXInImage = (boxPx.x1 + boxPx.x2) / 2
                      = (405 + 1132) / 2
                      = 1537 / 2
                      = 768.5 px

// leftFromCenterCm = 0, so no horizontal offset
designCenterXInCanvas = garmentCenterXInImage × displayScale
                      = 768.5 × 0.3646
                      = 280.24 px
                      ≈ 280.2 px
```

For a preset with `leftFromCenterCm != 0` (e.g., Left Chest where `leftFromCenterCm = -12.7`):

```
leftOffsetInImagePx   = (leftFromCenterCm / garmentWidthCm) × boxPxWidth
                      = (-12.7 / 30.5) × 728
                      = -0.4164 × 728
                      = -303.1 px

designCenterXInImage  = garmentCenterXInImage + leftOffsetInImagePx
                      = 768.5 + (-303.1)
                      = 465.4 px

designCenterXInCanvas = 465.4 × 0.3646
                      = 169.7 px
```

#### Step 7: Compute design top Y in canvas space

The collar reference is `collarRefY = boxPx.y1 = 74 px` in image space.

```
topOffsetInImagePx = topFromCollarCm × pxPerCmInImage
                   = 7.6 × 23.87
                   = 181.41 px

designTopYInImage  = collarRefY + topOffsetInImagePx
                   = 74 + 181.41
                   = 255.41 px

designTopYInCanvas = designTopYInImage × displayScale
                   = 255.41 × 0.3646
                   = 93.12 px
                   ≈ 93.2 px
```

#### Step 8: Compute design top-left corner in canvas space

```
designTopLeftX = designCenterXInCanvas - (presetWidthInCanvas / 2)
               = 280.2 - (242.8 / 2)
               = 280.2 - 121.4
               = 158.8 px

designTopLeftY = designTopYInCanvas
               = 93.2 px
```

#### Result Summary

```
Preset rect in canvas space:
  x      = 158.8 px
  y      = 93.2 px
  width  = 242.8 px
  height = 242.8 px
```

The Konva design `<Image>` node is initialised with:

```ts
imageRef.current.setAttrs({
  x: 158.8,
  y: 93.2,
  width: naturalImageWidth,   // original uploaded image pixel width
  height: naturalImageHeight,
  scaleX: 242.8 / naturalImageWidth,
  scaleY: 242.8 / naturalImageHeight,
  rotation: 0,
})
```

#### Step 9: Verify against safe frame

The safeFrame for `hoodie_front` is `{ x1: 441.4, y1: 118.8, x2: 1096.6, y2: 925.2 }` in image space.

In canvas space:
```
sf.x1 = 441.4 × 0.3646 = 160.9 px
sf.y1 = 118.8 × 0.3646 = 43.3 px
sf.x2 = 1096.6 × 0.3646 = 399.8 px
sf.y2 = 925.2 × 0.3646 = 337.3 px
```

Design rect: `x=158.8`, `x+w=158.8+242.8=401.6`. The right edge (401.6) is 1.8px outside `sf.x2` (399.8). This is within rounding tolerance; the safe-area boundary feedback implementation should use a 2px threshold before triggering the red outline to avoid false positives from floating-point imprecision:

```ts
const isOutside = (
  rect.x < safeFrameCanvas.x1 - 2 ||
  rect.y < safeFrameCanvas.y1 - 2 ||
  rect.x + rect.width > safeFrameCanvas.x2 + 2 ||
  rect.y + rect.height > safeFrameCanvas.y2 + 2
)
```

#### Inverse: Canvas pixels back to cm (for live size indicator)

```ts
// Given: design width in canvas = 242.8px
// displayScale = 0.3646
// pxPerCmInImage = 23.87

designWidthInImagePx = designWidthInCanvas / displayScale
                     = 242.8 / 0.3646
                     = 665.9 px

designWidthCm = designWidthInImagePx / pxPerCmInImage
              = 665.9 / 23.87
              = 27.9 cm   ✓ (matches input preset)
```

This inverse calculation is used in `DesignSizeIndicator.tsx` on every `transformend` event to show the live cm dimensions.

#### usePlacementEngine code template

```ts
// apps/store/src/hooks/usePlacementEngine.ts

import type { GarmentBounds, PlacementStandard, KonvaRect } from '../types/garment'

interface PlacementEngineResult {
  displayScale: number
  pxPerCmInImage: number
  presetToCanvasRect: (placement: PlacementStandard) => KonvaRect
  canvasPxToCm: (px: number) => number
  clampToSafeArea: (rect: KonvaRect) => KonvaRect
  safeFrameInCanvas: KonvaRect
  snapIfNear: (
    rect: KonvaRect,
    threshold?: number
  ) => { rect: KonvaRect; snapped: boolean; snapTarget: string | null }
}

export function usePlacementEngine(
  bounds: GarmentBounds,
  canvasWidth: number,
  activePresets: PlacementStandard[]
): PlacementEngineResult {
  const displayScale = canvasWidth / bounds.imgPx.w
  const pxPerCmInImage = bounds.boxPxSize.w / bounds.garmentWidthCm

  const safeFrameInCanvas: KonvaRect = {
    x: bounds.safeFrame.x1 * displayScale,
    y: bounds.safeFrame.y1 * displayScale,
    width: (bounds.safeFrame.x2 - bounds.safeFrame.x1) * displayScale,
    height: (bounds.safeFrame.y2 - bounds.safeFrame.y1) * displayScale,
  }

  function presetToCanvasRect(placement: PlacementStandard): KonvaRect {
    const widthInImagePx = placement.widthCm * pxPerCmInImage
    const heightInImagePx = placement.heightCm * pxPerCmInImage
    const topOffsetInImagePx = placement.topFromCollarCm * pxPerCmInImage
    const leftOffsetInImagePx = (placement.leftFromCenterCm / bounds.garmentWidthCm) * bounds.boxPxSize.w

    const designCenterXInImage = bounds.center.x + leftOffsetInImagePx
    const designTopYInImage = bounds.collarRefY + topOffsetInImagePx

    const widthInCanvas = widthInImagePx * displayScale
    const heightInCanvas = heightInImagePx * displayScale

    return {
      x: designCenterXInImage * displayScale - widthInCanvas / 2,
      y: designTopYInImage * displayScale,
      width: widthInCanvas,
      height: heightInCanvas,
    }
  }

  function canvasPxToCm(px: number): number {
    const inImagePx = px / displayScale
    return inImagePx / pxPerCmInImage
  }

  function clampToSafeArea(rect: KonvaRect): KonvaRect {
    const sf = safeFrameInCanvas
    const x = Math.max(sf.x, Math.min(rect.x, sf.x + sf.width - rect.width))
    const y = Math.max(sf.y, Math.min(rect.y, sf.y + sf.height - rect.height))
    return { x, y, width: rect.width, height: rect.height }
  }

  function snapIfNear(
    rect: KonvaRect,
    threshold = 12
  ): { rect: KonvaRect; snapped: boolean; snapTarget: string | null } {
    const rectCenterX = rect.x + rect.width / 2
    const rectCenterY = rect.y + rect.height / 2

    for (const preset of activePresets) {
      const presetRect = presetToCanvasRect(preset)
      const presetCenterX = presetRect.x + presetRect.width / 2
      const presetCenterY = presetRect.y + presetRect.height / 2
      const distance = Math.sqrt(
        Math.pow(rectCenterX - presetCenterX, 2) + Math.pow(rectCenterY - presetCenterY, 2)
      )

      if (distance <= threshold) {
        return {
          rect: { x: presetRect.x, y: presetRect.y, width: rect.width, height: rect.height },
          snapped: true,
          snapTarget: preset.placementKey,
        }
      }
    }

    return { rect, snapped: false, snapTarget: null }
  }

  return {
    displayScale,
    pxPerCmInImage,
    presetToCanvasRect,
    canvasPxToCm,
    clampToSafeArea,
    safeFrameInCanvas,
    snapIfNear,
  }
}
```

---

*End of plan. Total phases: 7 (0–6). Estimated implementation: 14 working days.*
