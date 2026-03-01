/**
 * KonvaCustomizeCanvas
 *
 * Three-layer Konva stage:
 *   Layer 0 — garment background image
 *   Layer 1 — safe-area dashed rectangle overlay
 *   Layer 2 — design objects (controlled externally via children prop)
 *
 * The canvas scales the garment image to fit canvasWidth while preserving
 * aspect ratio. All coordinates exposed to consumers are in canvas-display
 * pixels; use displayScale to convert to/from native image pixels.
 */

import { useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Line, Text, Circle } from 'react-konva';
import type Konva from 'konva';
import type { ReactNode } from 'react';
import type { KonvaRect } from '@/types/customization';

import { useKonvaImage } from '@/hooks/useKonvaImage';
import { useCanvasDimensions } from '@/hooks/useCanvasDimensions';
import type { ViewName } from '@/types/garment';
import CanvasLoadingSkeleton from './CanvasLoadingSkeleton';

export interface SafeAreaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KonvaCanvasReadyPayload {
  stageRef: Konva.Stage;
  displayScale: number;
  safeArea: SafeAreaRect;
  canvasWidth: number;
  canvasHeight: number;
}

interface Props {
  view: ViewName;
  /**
   * Cloudinary (or any) URL of the garment mockup image for this view.
   * If omitted, falls back to imageBaseUrl + garmentBounds.imageFile.
   */
  imageSrc?: string | null;
  /** Canvas display width in pixels (height is auto-computed from image AR) */
  canvasWidth?: number;
  /** Fallback image URL prefix — used only when imageSrc is not provided */
  imageBaseUrl?: string;
  /** Outside safe area = highlight rect in red */
  isOutsideSafeArea?: boolean;
  /**
   * Ghost rect shown as a dashed cyan outline in the overlay layer.
   * Used to preview a placement preset before the design is applied.
   */
  ghostRect?: KonvaRect | null;
  /** Enable drag/resize interactions for ghost rect */
  ghostRectEditable?: boolean;
  /** Called when ghost rect is moved/resized */
  onGhostRectChange?: (rect: KonvaRect) => void;
  /**
   * Crosshair point shown in the overlay layer when a snap is detected.
   * Rendered as two short intersecting lines at the given canvas coordinate.
   */
  snapCenter?: { x: number; y: number } | null;
  /** Called once the stage is mounted and ready */
  onReady?: (payload: KonvaCanvasReadyPayload) => void;
  /** Emits loaded garment image natural dimensions for active view */
  onImageMetaChange?: (meta: { naturalWidth: number; naturalHeight: number }) => void;
  /** Show ghost rect coordinate/size debug labels (TL/TR/BL/BR, W/H) */
  showGhostCoordinates?: boolean;
  /** Layer 2 design objects */
  children?: ReactNode;
}

const DEFAULT_CANVAS_WIDTH = 560;

export default function KonvaCustomizeCanvas({
  view,
  imageSrc: imageSrcProp,
  canvasWidth = DEFAULT_CANVAS_WIDTH,
  imageBaseUrl = '/blank-products',
  isOutsideSafeArea = false,
  ghostRect = null,
  ghostRectEditable = false,
  onGhostRectChange,
  snapCenter = null,
  onReady,
  onImageMetaChange,
  showGhostCoordinates = true,
  children,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const hasCalledReady = useRef(false);

  // ── Garment bounds ────────────────────────────────────────────────────────
  const bounds = null;

  // ── Garment image ─────────────────────────────────────────────────────────
  // Priority: explicit imageSrc prop > fallback from imageBaseUrl + filename
  const imageFile = null;
  const imageSrc = imageSrcProp !== undefined
    ? imageSrcProp
    : imageFile
      ? `${imageBaseUrl}/${encodeURIComponent(imageFile)}`
      : null;

  const [garmentImage, imageStatus] = useKonvaImage(imageSrc);

  const refImgW = bounds?.imgPx.w ?? 1536;
  const refImgH = bounds?.imgPx.h ?? 1024;
  const imgW = garmentImage?.naturalWidth ?? refImgW;
  const imgH = garmentImage?.naturalHeight ?? refImgH;
  const { canvasHeight, displayScale } = useCanvasDimensions(canvasWidth, imgW, imgH);

  // ── Compute scaled garment image dimensions and centering offset ──────────
  const scaledGarmentW = Math.round(imgW * displayScale);
  const scaledGarmentH = Math.round(imgH * displayScale);
  const garmentOffsetX = Math.round((canvasWidth - scaledGarmentW) / 2);
  const garmentOffsetY = Math.round((canvasHeight - scaledGarmentH) / 2);
  const refToRuntimeScaleX = refImgW > 0 ? imgW / refImgW : 1;
  const refToRuntimeScaleY = refImgH > 0 ? imgH / refImgH : 1;

  // ── Safe area rect in canvas coordinates ──────────────────────────────────
  const safeArea: SafeAreaRect = bounds
    ? {
        x: bounds.safeFrame.x1 * refToRuntimeScaleX * displayScale + garmentOffsetX,
        y: bounds.safeFrame.y1 * refToRuntimeScaleY * displayScale + garmentOffsetY,
        width: (bounds.safeFrame.x2 - bounds.safeFrame.x1) * refToRuntimeScaleX * displayScale,
        height: (bounds.safeFrame.y2 - bounds.safeFrame.y1) * refToRuntimeScaleY * displayScale,
      }
    : { x: canvasWidth * 0.05, y: canvasHeight * 0.05, width: canvasWidth * 0.9, height: canvasHeight * 0.9 };

  useEffect(() => {
    if (!garmentImage || !onImageMetaChange) return;
    onImageMetaChange({
      naturalWidth: garmentImage.naturalWidth,
      naturalHeight: garmentImage.naturalHeight,
    });
  }, [garmentImage, onImageMetaChange]);

  // ── Stage ready callback ──────────────────────────────────────────────────
  const handleStageRef = (stage: Konva.Stage | null) => {
    if (!stage || hasCalledReady.current) return;
    hasCalledReady.current = true;
    onReady?.({ stageRef: stage, displayScale, safeArea, canvasWidth, canvasHeight });
  };

  if (imageStatus === 'loading') {
    return <CanvasLoadingSkeleton width={canvasWidth} height={canvasHeight} />;
  }

  const MIN_GHOST_SIZE = 24;
  const commitGhostRect = (next: KonvaRect) => {
    if (!onGhostRectChange) return;
    onGhostRectChange({
      x: next.x,
      y: next.y,
      width: Math.max(MIN_GHOST_SIZE, next.width),
      height: Math.max(MIN_GHOST_SIZE, next.height),
    });
  };
  const rectFromPoints = (ax: number, ay: number, bx: number, by: number): KonvaRect => {
    let x = Math.min(ax, bx);
    let y = Math.min(ay, by);
    let width = Math.abs(bx - ax);
    let height = Math.abs(by - ay);
    if (width < MIN_GHOST_SIZE) {
      const cx = (ax + bx) / 2;
      width = MIN_GHOST_SIZE;
      x = cx - width / 2;
    }
    if (height < MIN_GHOST_SIZE) {
      const cy = (ay + by) / 2;
      height = MIN_GHOST_SIZE;
      y = cy - height / 2;
    }
    return { x, y, width, height };
  };
  const resizeGhostByHandle = (corner: 'tl' | 'tr' | 'bl' | 'br', x: number, y: number) => {
    if (!ghostRect) return;
    const tl = { x: ghostRect.x, y: ghostRect.y };
    const tr = { x: ghostRect.x + ghostRect.width, y: ghostRect.y };
    const bl = { x: ghostRect.x, y: ghostRect.y + ghostRect.height };
    const br = { x: ghostRect.x + ghostRect.width, y: ghostRect.y + ghostRect.height };
    if (corner === 'tl') commitGhostRect(rectFromPoints(br.x, br.y, x, y));
    if (corner === 'tr') commitGhostRect(rectFromPoints(bl.x, bl.y, x, y));
    if (corner === 'bl') commitGhostRect(rectFromPoints(tr.x, tr.y, x, y));
    if (corner === 'br') commitGhostRect(rectFromPoints(tl.x, tl.y, x, y));
  };

  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-white shadow-sm dark:bg-black"
      style={{ width: canvasWidth, height: canvasHeight }}
    >
      <Stage
        ref={(s) => {
          (stageRef as React.MutableRefObject<Konva.Stage | null>).current = s;
          handleStageRef(s);
        }}
        width={canvasWidth}
        height={canvasHeight}
      >
        {/* Layer 0 — garment background */}
        <Layer listening>
          {garmentImage && (
            <KonvaImage
              image={garmentImage}
              x={garmentOffsetX}
              y={garmentOffsetY}
              width={scaledGarmentW}
              height={scaledGarmentH}
              listening={false}
            />
          )}
        </Layer>

        {/* Layer 1 — safe area dashed overlay + ghost rect + snap crosshair */}
        <Layer listening={false}>
          {/* Safe-area boundary — only shown (red) when design goes outside bounds */}
          {isOutsideSafeArea && (
            <Rect
              x={safeArea.x}
              y={safeArea.y}
              width={safeArea.width}
              height={safeArea.height}
              stroke="#ef4444"
              strokeWidth={2}
              dash={[8, 4]}
              fill="transparent"
              cornerRadius={4}
              listening={false}
            />
          )}

          {/* Ghost rect — dashed cyan, shown when hovering/selecting a preset */}
          {ghostRect && (
            <>
              <Rect
                x={ghostRect.x}
                y={ghostRect.y}
                width={ghostRect.width}
                height={ghostRect.height}
                stroke="#06b6d4"
                strokeWidth={1.5}
                dash={[6, 3]}
                fill="rgba(6,182,212,0.08)"
                cornerRadius={2}
                listening={ghostRectEditable}
                draggable={ghostRectEditable}
                onDragMove={(e) => {
                  if (!ghostRectEditable) return;
                  commitGhostRect({
                    x: e.target.x(),
                    y: e.target.y(),
                    width: ghostRect.width,
                    height: ghostRect.height,
                  });
                }}
                onDragEnd={(e) => {
                  if (!ghostRectEditable) return;
                  commitGhostRect({
                    x: e.target.x(),
                    y: e.target.y(),
                    width: ghostRect.width,
                    height: ghostRect.height,
                  });
                }}
              />

              {showGhostCoordinates && (
                <>
                  {/* Corner coordinates */}
                  <Text
                    x={ghostRect.x + 4}
                    y={ghostRect.y + 4}
                    text={`TL (${Math.round(ghostRect.x)}, ${Math.round(ghostRect.y)})`}
                    fontSize={10}
                    fill="#facc15"
                    listening={false}
                  />
                  <Text
                    x={ghostRect.x + ghostRect.width - 92}
                    y={ghostRect.y + 4}
                    text={`TR (${Math.round(ghostRect.x + ghostRect.width)}, ${Math.round(ghostRect.y)})`}
                    fontSize={10}
                    fill="#facc15"
                    listening={false}
                  />
                  <Text
                    x={ghostRect.x + 4}
                    y={ghostRect.y + ghostRect.height - 14}
                    text={`BL (${Math.round(ghostRect.x)}, ${Math.round(ghostRect.y + ghostRect.height)})`}
                    fontSize={10}
                    fill="#facc15"
                    listening={false}
                  />
                  <Text
                    x={ghostRect.x + ghostRect.width - 100}
                    y={ghostRect.y + ghostRect.height - 14}
                    text={`BR (${Math.round(ghostRect.x + ghostRect.width)}, ${Math.round(ghostRect.y + ghostRect.height)})`}
                    fontSize={10}
                    fill="#facc15"
                    listening={false}
                  />

                  {/* Width/height readout */}
                  <Text
                    x={ghostRect.x + ghostRect.width / 2 - 48}
                    y={Math.max(0, ghostRect.y - 14)}
                    text={`W: ${Math.round(ghostRect.width)}px`}
                    fontSize={10}
                    fill="#0e7490"
                    listening={false}
                  />
                  <Text
                    x={ghostRect.x + ghostRect.width + 6}
                    y={ghostRect.y + ghostRect.height / 2 - 6}
                    text={`H: ${Math.round(ghostRect.height)}px`}
                    fontSize={10}
                    fill="#0e7490"
                    listening={false}
                  />
                </>
              )}

              {ghostRectEditable && (
                <>
                  <Circle
                    x={ghostRect.x}
                    y={ghostRect.y}
                    radius={5}
                    fill="#06b6d4"
                    stroke="#ffffff"
                    strokeWidth={1}
                    listening
                    draggable={ghostRectEditable}
                    hitStrokeWidth={18}
                    onDragMove={(e) => resizeGhostByHandle('tl', e.target.x(), e.target.y())}
                    onDragEnd={(e) => resizeGhostByHandle('tl', e.target.x(), e.target.y())}
                  />
                  <Circle
                    x={ghostRect.x + ghostRect.width}
                    y={ghostRect.y}
                    radius={5}
                    fill="#06b6d4"
                    stroke="#ffffff"
                    strokeWidth={1}
                    listening
                    draggable={ghostRectEditable}
                    hitStrokeWidth={18}
                    onDragMove={(e) => resizeGhostByHandle('tr', e.target.x(), e.target.y())}
                    onDragEnd={(e) => resizeGhostByHandle('tr', e.target.x(), e.target.y())}
                  />
                  <Circle
                    x={ghostRect.x}
                    y={ghostRect.y + ghostRect.height}
                    radius={5}
                    fill="#06b6d4"
                    stroke="#ffffff"
                    strokeWidth={1}
                    listening
                    draggable={ghostRectEditable}
                    hitStrokeWidth={18}
                    onDragMove={(e) => resizeGhostByHandle('bl', e.target.x(), e.target.y())}
                    onDragEnd={(e) => resizeGhostByHandle('bl', e.target.x(), e.target.y())}
                  />
                  <Circle
                    x={ghostRect.x + ghostRect.width}
                    y={ghostRect.y + ghostRect.height}
                    radius={5}
                    fill="#06b6d4"
                    stroke="#ffffff"
                    strokeWidth={1}
                    listening
                    draggable={ghostRectEditable}
                    hitStrokeWidth={18}
                    onDragMove={(e) => resizeGhostByHandle('br', e.target.x(), e.target.y())}
                    onDragEnd={(e) => resizeGhostByHandle('br', e.target.x(), e.target.y())}
                  />
                </>
              )}
            </>
          )}

          {/* Snap crosshair — two short lines at snap center */}
          {snapCenter && (
            <>
              <Line
                points={[snapCenter.x - 10, snapCenter.y, snapCenter.x + 10, snapCenter.y]}
                stroke="#3b82f6"
                strokeWidth={1.5}
                listening={false}
              />
              <Line
                points={[snapCenter.x, snapCenter.y - 10, snapCenter.x, snapCenter.y + 10]}
                stroke="#3b82f6"
                strokeWidth={1.5}
                listening={false}
              />
            </>
          )}
        </Layer>

        {/* Layer 2 — design objects (controlled by parent) */}
        <Layer>{children}</Layer>
      </Stage>
    </div>
  );
}
