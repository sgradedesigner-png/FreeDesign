import { useMemo } from 'react';

export interface CanvasDimensions {
  canvasWidth: number;
  canvasHeight: number;
  /** displayScale = canvasWidth / imgPxW — multiply image-space coords by this to get canvas coords */
  displayScale: number;
}

/**
 * Compute canvas dimensions with forced 4:3 aspect ratio.
 *
 * Canvas is always 4:3 (portrait-ish) regardless of garment image aspect ratio.
 * The garment image is scaled to fit within this 4:3 canvas, preserving its aspect ratio.
 *
 * For landscape images (hoodie front, 1536×1024 = 3:2):
 *   Canvas: 560×420 (4:3)
 *   Image scales to fit width → 560×373 → centered vertically with 23px padding top/bottom
 *
 * For portrait images (hoodie left sleeve, 1024×1536 = 2:3):
 *   Canvas: 560×420 (4:3)
 *   Image scales to fit height → 280×420 → centered horizontally with 140px padding left/right
 */
export function useCanvasDimensions(
  canvasWidth: number,
  imgPxW: number,
  imgPxH: number
): CanvasDimensions {
  return useMemo(() => {
    const w = Math.max(1, imgPxW);
    const h = Math.max(1, imgPxH);

    // Force 4:3 aspect ratio for canvas (3/4 = 0.75)
    const canvasHeight = Math.round(canvasWidth * 0.75);

    // Compute displayScale to fit the image within the 4:3 canvas
    // Scale by whichever dimension constrains more (width or height)
    const scaleByWidth = canvasWidth / w;
    const scaleByHeight = canvasHeight / h;
    const displayScale = Math.min(scaleByWidth, scaleByHeight);

    return { canvasWidth, canvasHeight, displayScale };
  }, [canvasWidth, imgPxW, imgPxH]);
}
