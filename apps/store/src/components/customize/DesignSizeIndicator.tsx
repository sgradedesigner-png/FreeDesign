/**
 * DesignSizeIndicator
 *
 * Shows the current print-area dimensions in centimetres, live-updating
 * as the user resizes the design via the Konva Transformer.
 *
 * Math (Section 6 of CUSTOMIZATION_PAGE_PLAN.md):
 *   effectiveCanvasPx   = naturalPx * scaleXY
 *   imagePx             = effectiveCanvasPx / displayScale
 *   cm                  = imagePx / pxPerCmInImage
 */

import { cn } from '@/lib/utils';
import type { KonvaImageAttrs } from '@/types/customization';

interface Props {
  /** Controlled attrs from KonvaDesignImage */
  attrs: KonvaImageAttrs | null;
  /** Base canvas size of the design node (from preset rect) */
  naturalWidth: number;
  naturalHeight: number;
  /** displayScale = canvasWidth / imageNativePxWidth */
  displayScale: number;
  /** px per cm in native image coordinates */
  pxPerCmInImage: number;
  className?: string;
}

export default function DesignSizeIndicator({
  attrs,
  naturalWidth,
  naturalHeight,
  displayScale,
  pxPerCmInImage,
  className,
}: Props) {
  if (!attrs || displayScale === 0 || pxPerCmInImage === 0) return null;

  const effectiveW = naturalWidth  * Math.abs(attrs.scaleX);
  const effectiveH = naturalHeight * Math.abs(attrs.scaleY);

  const widthCm  = effectiveW / displayScale / pxPerCmInImage;
  const heightCm = effectiveH / displayScale / pxPerCmInImage;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/80 px-2.5 py-1 text-xs font-mono text-muted-foreground shadow-sm backdrop-blur-sm',
        className
      )}
      aria-label="Design print dimensions"
    >
      <span className="text-foreground font-semibold">
        {widthCm.toFixed(1)}
        <span className="text-muted-foreground font-normal">cm</span>
      </span>
      <span className="text-muted-foreground">×</span>
      <span className="text-foreground font-semibold">
        {heightCm.toFixed(1)}
        <span className="text-muted-foreground font-normal">cm</span>
      </span>
    </div>
  );
}
