/**
 * KonvaDesignImage
 *
 * A controlled Konva Image node with an attached Transformer for
 * drag / resize / rotate interaction.
 *
 * Coordinate conventions:
 *   - attrs.x / attrs.y  = center of the image in canvas pixels
 *   - naturalWidth/Height = base canvas dimensions (from preset rect)
 *   - attrs.scaleX/Y      = Transformer scale factors (1 = preset size)
 *   - attrs.rotation      = degrees
 *
 * Undo/redo is handled by the parent: when `attrs` changes externally
 * (e.g. after undo) the image node is imperatively synced via a
 * useEffect + Konva imperative API so React doesn't fight the drag.
 */

import { useEffect, useRef } from 'react';
import { Image as KonvaImage, Transformer, Circle, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaImageAttrs } from '@/types/customization';

export interface KonvaDesignImageProps {
  /** Loaded HTMLImageElement for the design */
  imageElement: HTMLImageElement;
  /** Base canvas width (pixels) — set from preset rect width */
  naturalWidth: number;
  /** Base canvas height (pixels) — set from preset rect height */
  naturalHeight: number;
  /** Controlled attrs — drives position/scale/rotation */
  attrs: KonvaImageAttrs;
  /** Called after every drag-end or transform-end with updated attrs */
  onChangeEnd: (attrs: KonvaImageAttrs) => void;
  /** Whether the Transformer handles are shown */
  isSelected: boolean;
  /** Called when the image node is clicked/tapped */
  onSelect: () => void;
}

export default function KonvaDesignImage({
  imageElement,
  naturalWidth,
  naturalHeight,
  attrs,
  onChangeEnd,
  isSelected,
  onSelect,
}: KonvaDesignImageProps) {
  const imageRef = useRef<Konva.Image>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  // Tracks whether user is mid-interaction so we skip prop syncing
  const interacting = useRef(false);

  // ── Attach Transformer to Image when selected ───────────────────────────
  useEffect(() => {
    if (!transformerRef.current || !imageRef.current) return;
    if (isSelected) {
      transformerRef.current.nodes([imageRef.current]);
    } else {
      transformerRef.current.nodes([]);
    }
    transformerRef.current.getLayer()?.batchDraw();
  }, [isSelected]);

  // ── Sync external attr changes (undo/redo) to Konva node ────────────────
  useEffect(() => {
    if (!imageRef.current || interacting.current) return;
    const node = imageRef.current;
    node.x(attrs.x);
    node.y(attrs.y);
    node.scaleX(attrs.scaleX);
    node.scaleY(attrs.scaleY);
    node.rotation(attrs.rotation);
    node.getLayer()?.batchDraw();
  }, [attrs]);

  // ── Read current node attrs and emit ────────────────────────────────────
  const emitAttrs = () => {
    if (!imageRef.current) return;
    const node = imageRef.current;
    onChangeEnd({
      x: node.x(),
      y: node.y(),
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
      rotation: node.rotation(),
    });
  };

  const cos = Math.cos((attrs.rotation * Math.PI) / 180);
  const sin = Math.sin((attrs.rotation * Math.PI) / 180);
  const halfW = naturalWidth / 2;
  const halfH = naturalHeight / 2;
  const sx = attrs.scaleX;
  const sy = attrs.scaleY;
  const corners = [
    { key: 'TL', lx: -halfW, ly: -halfH },
    { key: 'TR', lx: halfW, ly: -halfH },
    { key: 'BR', lx: halfW, ly: halfH },
    { key: 'BL', lx: -halfW, ly: halfH },
  ].map((c) => {
    const dx = c.lx * sx;
    const dy = c.ly * sy;
    return {
      key: c.key,
      x: attrs.x + dx * cos - dy * sin,
      y: attrs.y + dx * sin + dy * cos,
    };
  });

  return (
    <>
      <KonvaImage
        ref={imageRef}
        image={imageElement}
        // Center-based positioning: offset = half natural size
        x={attrs.x}
        y={attrs.y}
        width={naturalWidth}
        height={naturalHeight}
        offsetX={naturalWidth / 2}
        offsetY={naturalHeight / 2}
        scaleX={attrs.scaleX}
        scaleY={attrs.scaleY}
        rotation={attrs.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragStart={() => { interacting.current = true; }}
        onDragEnd={() => {
          interacting.current = false;
          emitAttrs();
        }}
        onTransformStart={() => { interacting.current = true; }}
        onTransformEnd={() => {
          interacting.current = false;
          emitAttrs();
        }}
      />

      <Transformer
        ref={transformerRef}
        keepRatio={true}
        rotateEnabled={true}
        borderStroke="#3b82f6"
        borderStrokeWidth={1.5}
        anchorSize={10}
        anchorCornerRadius={2}
        rotateAnchorOffset={24}
        enabledAnchors={[
          'top-left',
          'top-right',
          'bottom-left',
          'bottom-right',
        ]}
      />

      {/* Uploaded image corner coordinates */}
      {corners.map((c) => (
        <Circle
          key={`corner-dot-${c.key}`}
          x={c.x}
          y={c.y}
          radius={3}
          fill="#2563eb"
          stroke="#ffffff"
          strokeWidth={1}
          listening={false}
        />
      ))}
      {corners.map((c) => (
        <Text
          key={`corner-label-${c.key}`}
          x={c.key === 'TL' || c.key === 'BL' ? c.x - 110 : c.x + 8}
          y={c.key === 'TL' || c.key === 'TR' ? c.y - 18 : c.y + 6}
          text={`${c.key} (${Math.round(c.x)}, ${Math.round(c.y)})`}
          fontSize={10}
          fill="#facc15"
          listening={false}
        />
      ))}
    </>
  );
}
