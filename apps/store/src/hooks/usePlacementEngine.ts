/**
 * usePlacementEngine (template-only)
 *
 * Canonical source: layoutTemplate preset rectNorm (0..1 image-space).
 * Runtime output: Konva canvas rects in display pixels.
 */

import { useCallback, useMemo } from 'react';
import type { ProductType, SizeCategory, ViewName } from '@/types/garment';
import type { KonvaRect } from '@/types/customization';

export type { KonvaRect };

export interface SnapResult {
  rect: KonvaRect;
  snapped: boolean;
  snapTarget: string | null;
}

export interface NormalizedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EnginePlacement {
  placementKey: string;
  view: ViewName;
  label?: string;
  widthCm?: number;
  heightCm?: number;
  topFromCollarCm?: number;
  leftFromCenterCm?: number;
  rectNorm?: NormalizedRect;
  source?: string;
}

export const SNAP_THRESHOLD_PX = 12;

/**
 * @param _productType  Unused (kept for call-site compatibility)
 * @param view         Active canvas view (front/back/left/right)
 * @param _sizeCategory Unused (kept for call-site compatibility)
 * @param canvasWidth  Canvas display width in pixels (usually 560)
 */
export function usePlacementEngine(
  _productType: ProductType,
  view: ViewName,
  _sizeCategory: SizeCategory,
  canvasWidth: number,
  runtimeImageSize?: { width: number; height: number } | null,
  templatePlacements?: EnginePlacement[] | null
) {
  // Template-only mode: no legacy garment bounds lookup.
  const bounds = null;

  // Canvas is fixed 4:3.
  const refImgW = 1536;
  const refImgH = 1024;
  const imgW = runtimeImageSize?.width ?? refImgW;
  const imgH = runtimeImageSize?.height ?? refImgH;
  const canvasHeight = Math.round(canvasWidth * 0.75);

  // Fit image into 4:3 canvas.
  const scaleByWidth = canvasWidth / imgW;
  const scaleByHeight = canvasHeight / imgH;
  const displayScale = Math.min(scaleByWidth, scaleByHeight);

  // Center image in canvas.
  const scaledGarmentW = Math.round(imgW * displayScale);
  const scaledGarmentH = Math.round(imgH * displayScale);
  const garmentOffsetX = Math.round((canvasWidth - scaledGarmentW) / 2);
  const garmentOffsetY = Math.round((canvasHeight - scaledGarmentH) / 2);

  // Kept for downstream indicator API; template-only flow does not rely on cm math.
  const pxPerCmInImage = 1;

  // Safe area == full visible image in template-only mode.
  const safeAreaRect: KonvaRect | null = useMemo(() => {
    return {
      x: garmentOffsetX,
      y: garmentOffsetY,
      width: scaledGarmentW,
      height: scaledGarmentH,
    };
  }, [garmentOffsetX, garmentOffsetY, scaledGarmentW, scaledGarmentH]);

  // Presets for current view from template.
  const templatePlacementsForView = useMemo(
    () => (templatePlacements ?? []).filter((placement) => placement.view === view),
    [templatePlacements, view]
  );

  const placements = useMemo<EnginePlacement[]>(
    () => templatePlacementsForView,
    [templatePlacementsForView]
  );

  // Kept for compatibility with current consumers.
  const cmToCanvasPx = useCallback(
    (cm: number): number => cm * pxPerCmInImage * displayScale,
    [pxPerCmInImage, displayScale]
  );

  // Convert normalized image-space rect to canvas-space rect.
  const presetToCanvasRect = useCallback(
    (placement: EnginePlacement): KonvaRect => {
      if (!placement.rectNorm) return { x: 0, y: 0, width: 100, height: 100 };

      return {
        x: placement.rectNorm.x * imgW * displayScale + garmentOffsetX,
        y: placement.rectNorm.y * imgH * displayScale + garmentOffsetY,
        width: placement.rectNorm.w * imgW * displayScale,
        height: placement.rectNorm.h * imgH * displayScale,
      };
    },
    [displayScale, garmentOffsetX, garmentOffsetY, imgW, imgH]
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
