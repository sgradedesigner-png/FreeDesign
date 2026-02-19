/**
 * usePlacementEngine
 *
 * Mathematical core for the DTF customization canvas.
 * Converts PlacementStandard measurements (cm) into Konva canvas coordinates (px).
 *
 * Reference math (Section 6 of CUSTOMIZATION_PAGE_PLAN.md):
 *   pxPerCmInImage = boxPxWidth / garmentWidthCm
 *   designWCanvas  = widthCm * pxPerCmInImage * displayScale
 *   designXCanvas  = (centerX + leftOffsetImg - designWImg/2) * displayScale
 *   designYCanvas  = (boxPx.y1 + topFromCollarCm * pxPerCmInImage) * displayScale
 */

import { useCallback, useMemo } from 'react';
import type { PlacementStandard, ProductType, SizeCategory, ViewName } from '@/types/garment';
import type { KonvaRect } from '@/types/customization';
import { getGarmentBounds } from '@/lib/garmentBoundsLoader';
import { listPlacements } from '@/lib/placementLoader';

export type { KonvaRect };

export interface SnapResult {
  rect: KonvaRect;
  snapped: boolean;
  snapTarget: string | null;
}

export const SNAP_THRESHOLD_PX = 12;
const APPAREL_FRONT_BACK_REFERENCE_WIDTH_CM = 38.1; // 15" max print reference
const CENTER_CHEST_OVERRIDE_WIDTH_CM = 15.2;
const CENTER_CHEST_OVERRIDE_HEIGHT_CM = 10.1;
const LEFT_CHEST_OVERRIDE_WIDTH_CM = 7.2;
const LEFT_CHEST_OVERRIDE_HEIGHT_CM = 7.2;
const LEFT_CHEST_OVERRIDE_TOP_FROM_COLLAR_CM = 6.8;
const LEFT_CHEST_OVERRIDE_LEFT_FROM_CENTER_CM = 6.1;
const FULL_FRONT_OVERRIDE_WIDTH_CM = 15.2;
const FULL_FRONT_OVERRIDE_HEIGHT_CM = 20.7;
const FULL_FRONT_OVERRIDE_TOP_FROM_COLLAR_CM = 7.6;
const OVERSIZE_FRONT_OVERRIDE_WIDTH_CM = 18.7;
const OVERSIZE_FRONT_OVERRIDE_HEIGHT_CM = 25.5;
const OVERSIZE_FRONT_OVERRIDE_TOP_FROM_COLLAR_CM = 7.6;
const ACROSS_CHEST_OVERRIDE_WIDTH_CM = 19.4;
const ACROSS_CHEST_OVERRIDE_HEIGHT_CM = 7.9;
const ACROSS_CHEST_OVERRIDE_TOP_FROM_COLLAR_CM = 7.6;
const BACK_FULL_OVERRIDE_WIDTH_CM = 16.9;
const BACK_FULL_OVERRIDE_HEIGHT_CM = 23.1;
const BACK_FULL_OVERRIDE_TOP_FROM_COLLAR_CM = 5.1;
const BACK_FULL_OVERRIDE_LEFT_FROM_CENTER_CM = 0;
const LEFT_SLEEVE_OVERRIDE_WIDTH_CM = 8.6;
const LEFT_SLEEVE_OVERRIDE_HEIGHT_CM = 5.7;
const LEFT_SLEEVE_OVERRIDE_TOP_FROM_COLLAR_CM = 12.8;
const LEFT_SLEEVE_OVERRIDE_LEFT_FROM_CENTER_CM = 2.0;
const RIGHT_SLEEVE_OVERRIDE_WIDTH_CM = 8.6;
const RIGHT_SLEEVE_OVERRIDE_HEIGHT_CM = 5.7;
const RIGHT_SLEEVE_OVERRIDE_TOP_FROM_COLLAR_CM = 12.6;
const RIGHT_SLEEVE_OVERRIDE_LEFT_FROM_CENTER_CM = -1.4;

/**
 * @param productType  Current garment type
 * @param view         Active canvas view (front/back/left/right)
 * @param sizeCategory Customer garment size category (used to select preset variant)
 * @param canvasWidth  Canvas display width in pixels (usually 560)
 */
export function usePlacementEngine(
  productType: ProductType,
  view: ViewName,
  sizeCategory: SizeCategory,
  canvasWidth: number
) {
  // ── Garment bounds ──────────────────────────────────────────────────────────
  const bounds = useMemo(() => {
    try {
      return getGarmentBounds(productType, view);
    } catch {
      return null;
    }
  }, [productType, view]);

  // Canvas is forced to 4:3 aspect ratio — compute canvas height
  const imgW = bounds?.imgPx.w ?? 1536;
  const imgH = bounds?.imgPx.h ?? 1024;
  const canvasHeight = Math.round(canvasWidth * 0.75); // 4:3 aspect ratio

  // displayScale to fit image within 4:3 canvas
  const scaleByWidth = canvasWidth / imgW;
  const scaleByHeight = canvasHeight / imgH;
  const displayScale = Math.min(scaleByWidth, scaleByHeight);

  // Garment image offset (centering within 4:3 canvas)
  const scaledGarmentW = Math.round(imgW * displayScale);
  const scaledGarmentH = Math.round(imgH * displayScale);
  const garmentOffsetX = Math.round((canvasWidth - scaledGarmentW) / 2);
  const garmentOffsetY = Math.round((canvasHeight - scaledGarmentH) / 2);

  // px per cm in native image coordinates
  const placementReferenceWidthCm = useMemo(() => {
    const isApparelFrontBack =
      (productType === 'hoodie' || productType === 'sweatshirt' || productType === 'polo' || productType === 'tanktop') &&
      (view === 'front' || view === 'back');
    if (isApparelFrontBack) return APPAREL_FRONT_BACK_REFERENCE_WIDTH_CM;
    return bounds?.garmentWidthCm ?? 30.5;
  }, [productType, view, bounds?.garmentWidthCm]);

  const pxPerCmInImage = bounds
    ? (bounds.boxPx.x2 - bounds.boxPx.x1) / placementReferenceWidthCm
    : 1;

  // ── Safe area in canvas px ──────────────────────────────────────────────────
  const safeAreaRect: KonvaRect | null = useMemo(() => {
    if (!bounds) return null;
    return {
      x: bounds.safeFrame.x1 * displayScale + garmentOffsetX,
      y: bounds.safeFrame.y1 * displayScale + garmentOffsetY,
      width:  (bounds.safeFrame.x2 - bounds.safeFrame.x1) * displayScale,
      height: (bounds.safeFrame.y2 - bounds.safeFrame.y1) * displayScale,
    };
  }, [bounds, displayScale, garmentOffsetX, garmentOffsetY]);

  // ── Available placements for this product+view ──────────────────────────────
  const allPlacements = useMemo(() => listPlacements(productType, view), [productType, view]);

  /**
   * Deduplicated list: one entry per placementKey, preferring the sizeCategory
   * match, falling back to the first entry (usually Adult).
   */
  const placements = useMemo(() => {
    const withOverrides = (p: PlacementStandard): PlacementStandard => {
      const isApparelFront =
        view === 'front' &&
        (productType === 'hoodie' || productType === 'sweatshirt' || productType === 'polo' || productType === 'tanktop');
      const isApparelBack =
        view === 'back' &&
        (productType === 'hoodie' || productType === 'sweatshirt' || productType === 'polo' || productType === 'tanktop');
      const isApparelLeftSleeve =
        view === 'left' &&
        (productType === 'hoodie' || productType === 'sweatshirt' || productType === 'polo');
      const isApparelRightSleeve =
        view === 'right' &&
        (productType === 'hoodie' || productType === 'sweatshirt' || productType === 'polo');
      if (!isApparelFront && !isApparelBack && !isApparelLeftSleeve && !isApparelRightSleeve) return p;

      if (p.placementKey === 'front_center') {
        return {
          ...p,
          widthCm: CENTER_CHEST_OVERRIDE_WIDTH_CM,
          heightCm: CENTER_CHEST_OVERRIDE_HEIGHT_CM,
        };
      }

      if (p.placementKey === 'front_left_chest') {
        return {
          ...p,
          widthCm: LEFT_CHEST_OVERRIDE_WIDTH_CM,
          heightCm: LEFT_CHEST_OVERRIDE_HEIGHT_CM,
          topFromCollarCm: LEFT_CHEST_OVERRIDE_TOP_FROM_COLLAR_CM,
          leftFromCenterCm: LEFT_CHEST_OVERRIDE_LEFT_FROM_CENTER_CM,
        };
      }

      if (p.placementKey === 'full_front') {
        return {
          ...p,
          widthCm: FULL_FRONT_OVERRIDE_WIDTH_CM,
          heightCm: FULL_FRONT_OVERRIDE_HEIGHT_CM,
          topFromCollarCm: FULL_FRONT_OVERRIDE_TOP_FROM_COLLAR_CM,
          leftFromCenterCm: 0,
        };
      }

      if (p.placementKey === 'oversize_front') {
        return {
          ...p,
          widthCm: OVERSIZE_FRONT_OVERRIDE_WIDTH_CM,
          heightCm: OVERSIZE_FRONT_OVERRIDE_HEIGHT_CM,
          topFromCollarCm: OVERSIZE_FRONT_OVERRIDE_TOP_FROM_COLLAR_CM,
          leftFromCenterCm: 0,
        };
      }

      if (p.placementKey === 'across_chest') {
        return {
          ...p,
          widthCm: ACROSS_CHEST_OVERRIDE_WIDTH_CM,
          heightCm: ACROSS_CHEST_OVERRIDE_HEIGHT_CM,
          topFromCollarCm: ACROSS_CHEST_OVERRIDE_TOP_FROM_COLLAR_CM,
          leftFromCenterCm: 0,
        };
      }

      if (isApparelBack && (p.placementKey === 'back_center' || p.placementKey === 'full_back')) {
        return {
          ...p,
          widthCm: BACK_FULL_OVERRIDE_WIDTH_CM,
          heightCm: BACK_FULL_OVERRIDE_HEIGHT_CM,
          topFromCollarCm: BACK_FULL_OVERRIDE_TOP_FROM_COLLAR_CM,
          leftFromCenterCm: BACK_FULL_OVERRIDE_LEFT_FROM_CENTER_CM,
        };
      }

      if (isApparelLeftSleeve && p.placementKey === 'sleeve') {
        return {
          ...p,
          widthCm: LEFT_SLEEVE_OVERRIDE_WIDTH_CM,
          heightCm: LEFT_SLEEVE_OVERRIDE_HEIGHT_CM,
          topFromCollarCm: LEFT_SLEEVE_OVERRIDE_TOP_FROM_COLLAR_CM,
          leftFromCenterCm: LEFT_SLEEVE_OVERRIDE_LEFT_FROM_CENTER_CM,
        };
      }
      if (isApparelRightSleeve && p.placementKey === 'sleeve') {
        return {
          ...p,
          widthCm: RIGHT_SLEEVE_OVERRIDE_WIDTH_CM,
          heightCm: RIGHT_SLEEVE_OVERRIDE_HEIGHT_CM,
          topFromCollarCm: RIGHT_SLEEVE_OVERRIDE_TOP_FROM_COLLAR_CM,
          leftFromCenterCm: RIGHT_SLEEVE_OVERRIDE_LEFT_FROM_CENTER_CM,
        };
      }

      return p;
    };

    const map = new Map<string, PlacementStandard>();
    for (const p of allPlacements) {
      const existing = map.get(p.placementKey);
      if (!existing || p.sizeCategory === sizeCategory) {
        map.set(p.placementKey, p);
      }
    }
    return Array.from(map.values()).map(withOverrides);
  }, [allPlacements, sizeCategory, productType, view]);

  // ── Core conversion functions ───────────────────────────────────────────────

  /** Convert a real-world cm measurement to canvas display pixels (scalar). */
  const cmToCanvasPx = useCallback(
    (cm: number): number => cm * pxPerCmInImage * displayScale,
    [pxPerCmInImage, displayScale]
  );

  /**
   * Convert a PlacementStandard to an axis-aligned rect in canvas coordinates.
   *
   * X: garment center + leftFromCenterCm offset − half design width + garment offset
   * Y: boxPx.y1 (collar) + topFromCollarCm + garment offset
   */
  const presetToCanvasRect = useCallback(
    (placement: PlacementStandard): KonvaRect => {
      if (!bounds) return { x: 0, y: 0, width: 100, height: 100 };
      const isApparelFront =
        view === 'front' &&
        (productType === 'hoodie' || productType === 'sweatshirt' || productType === 'polo' || productType === 'tanktop');
      const isApparelBack =
        view === 'back' &&
        (productType === 'hoodie' || productType === 'sweatshirt' || productType === 'polo' || productType === 'tanktop');
      const isApparelLeftSleeve =
        view === 'left' &&
        (productType === 'hoodie' || productType === 'sweatshirt' || productType === 'polo');
      const isApparelRightSleeve =
        view === 'right' &&
        (productType === 'hoodie' || productType === 'sweatshirt' || productType === 'polo');
      const resolvedPlacement: PlacementStandard = (() => {
        if (isApparelFront && placement.placementKey === 'front_center') {
          return {
            ...placement,
            widthCm: CENTER_CHEST_OVERRIDE_WIDTH_CM,
            heightCm: CENTER_CHEST_OVERRIDE_HEIGHT_CM,
          };
        }
        if (isApparelFront && placement.placementKey === 'front_left_chest') {
          return {
            ...placement,
            widthCm: LEFT_CHEST_OVERRIDE_WIDTH_CM,
            heightCm: LEFT_CHEST_OVERRIDE_HEIGHT_CM,
            topFromCollarCm: LEFT_CHEST_OVERRIDE_TOP_FROM_COLLAR_CM,
            leftFromCenterCm: LEFT_CHEST_OVERRIDE_LEFT_FROM_CENTER_CM,
          };
        }
        if (isApparelFront && placement.placementKey === 'full_front') {
          return {
            ...placement,
            widthCm: FULL_FRONT_OVERRIDE_WIDTH_CM,
            heightCm: FULL_FRONT_OVERRIDE_HEIGHT_CM,
            topFromCollarCm: FULL_FRONT_OVERRIDE_TOP_FROM_COLLAR_CM,
            leftFromCenterCm: 0,
          };
        }
        if (isApparelFront && placement.placementKey === 'oversize_front') {
          return {
            ...placement,
            widthCm: OVERSIZE_FRONT_OVERRIDE_WIDTH_CM,
            heightCm: OVERSIZE_FRONT_OVERRIDE_HEIGHT_CM,
            topFromCollarCm: OVERSIZE_FRONT_OVERRIDE_TOP_FROM_COLLAR_CM,
            leftFromCenterCm: 0,
          };
        }
        if (isApparelFront && placement.placementKey === 'across_chest') {
          return {
            ...placement,
            widthCm: ACROSS_CHEST_OVERRIDE_WIDTH_CM,
            heightCm: ACROSS_CHEST_OVERRIDE_HEIGHT_CM,
            topFromCollarCm: ACROSS_CHEST_OVERRIDE_TOP_FROM_COLLAR_CM,
            leftFromCenterCm: 0,
          };
        }
        if (isApparelBack && (placement.placementKey === 'back_center' || placement.placementKey === 'full_back')) {
          return {
            ...placement,
            widthCm: BACK_FULL_OVERRIDE_WIDTH_CM,
            heightCm: BACK_FULL_OVERRIDE_HEIGHT_CM,
            topFromCollarCm: BACK_FULL_OVERRIDE_TOP_FROM_COLLAR_CM,
            leftFromCenterCm: BACK_FULL_OVERRIDE_LEFT_FROM_CENTER_CM,
          };
        }
        if (isApparelLeftSleeve && placement.placementKey === 'sleeve') {
          return {
            ...placement,
            widthCm: LEFT_SLEEVE_OVERRIDE_WIDTH_CM,
            heightCm: LEFT_SLEEVE_OVERRIDE_HEIGHT_CM,
            topFromCollarCm: LEFT_SLEEVE_OVERRIDE_TOP_FROM_COLLAR_CM,
            leftFromCenterCm: LEFT_SLEEVE_OVERRIDE_LEFT_FROM_CENTER_CM,
          };
        }
        if (isApparelRightSleeve && placement.placementKey === 'sleeve') {
          return {
            ...placement,
            widthCm: RIGHT_SLEEVE_OVERRIDE_WIDTH_CM,
            heightCm: RIGHT_SLEEVE_OVERRIDE_HEIGHT_CM,
            topFromCollarCm: RIGHT_SLEEVE_OVERRIDE_TOP_FROM_COLLAR_CM,
            leftFromCenterCm: RIGHT_SLEEVE_OVERRIDE_LEFT_FROM_CENTER_CM,
          };
        }
        return placement;
      })();

      const boxPxWidth = bounds.boxPx.x2 - bounds.boxPx.x1;
      const pxPerCm   = boxPxWidth / placementReferenceWidthCm;
      const widthCm = resolvedPlacement.widthCm;
      const heightCm = resolvedPlacement.heightCm;

      const designWImg = widthCm  * pxPerCm;
      const designHImg = heightCm * pxPerCm;

      // Horizontal
      const offsetPxImg     = (resolvedPlacement.leftFromCenterCm / placementReferenceWidthCm) * boxPxWidth;
      const designCenterXImg = bounds.center.x + offsetPxImg;
      const designXImg       = designCenterXImg - designWImg / 2;

      // Vertical (collar = boxPx.y1)
      const designYImg = bounds.boxPx.y1 + resolvedPlacement.topFromCollarCm * pxPerCm;

      return {
        x:      designXImg  * displayScale + garmentOffsetX,
        y:      designYImg  * displayScale + garmentOffsetY,
        width:  designWImg  * displayScale,
        height: designHImg  * displayScale,
      };
    },
    [bounds, displayScale, garmentOffsetX, garmentOffsetY, placementReferenceWidthCm, productType, view]
  );

  /**
   * Clamp a design rect so it stays within the safe area.
   * Ensures the rect never overflows the safe frame boundaries.
   */
  const clampToSafeArea = useCallback(
    (rect: KonvaRect): KonvaRect => {
      if (!safeAreaRect) return rect;
      const x = Math.max(
        safeAreaRect.x,
        Math.min(rect.x, safeAreaRect.x + safeAreaRect.width  - rect.width)
      );
      const y = Math.max(
        safeAreaRect.y,
        Math.min(rect.y, safeAreaRect.y + safeAreaRect.height - rect.height)
      );
      return { ...rect, x, y };
    },
    [safeAreaRect]
  );

  /**
   * Snap a design rect to the nearest preset center if within `threshold` px.
   * When snapped, the rect is repositioned to align with the preset origin
   * (preserving the dragged rect's width/height).
   */
  const snapIfNear = useCallback(
    (rect: KonvaRect, threshold = SNAP_THRESHOLD_PX): SnapResult => {
      const cx = rect.x + rect.width  / 2;
      const cy = rect.y + rect.height / 2;

      for (const placement of placements) {
        const target = presetToCanvasRect(placement);
        const tx     = target.x + target.width  / 2;
        const ty     = target.y + target.height / 2;
        if (Math.hypot(cx - tx, cy - ty) <= threshold) {
          return {
            rect: { x: target.x, y: target.y, width: rect.width, height: rect.height },
            snapped: true,
            snapTarget: placement.placementKey,
          };
        }
      }
      return { rect, snapped: false, snapTarget: null };
    },
    [placements, presetToCanvasRect]
  );

  return {
    bounds,
    displayScale,
    pxPerCmInImage,
    placements,
    safeAreaRect,
    cmToCanvasPx,
    presetToCanvasRect,
    clampToSafeArea,
    snapIfNear,
  };
}
