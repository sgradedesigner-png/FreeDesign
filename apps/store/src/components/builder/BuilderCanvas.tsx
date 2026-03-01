/**
 * BuilderCanvas.tsx
 * P3-03 — Interactive gang sheet canvas
 *
 * Renders canvas items as absolutely-positioned elements inside a scaled
 * container. Supports drag-to-move and click-to-select.
 * Resize handles and rotation are left for P3-03 follow-up polish.
 */

import { useRef, useState, useCallback } from 'react';
import type { CanvasItem } from '@/data/builder.api';

type BuilderCanvasProps = {
  widthCm:  number;
  heightCm: number;
  items:    CanvasItem[];
  selectedId: string | null;
  onSelect:   (id: string | null) => void;
  onMove:     (id: string, xCm: number, yCm: number) => void;
};

/** 1 cm → px conversion for canvas display (screen DPI-agnostic) */
const CM_TO_PX = 37.8; // ~96 dpi

export function BuilderCanvas({
  widthCm,
  heightCm,
  items,
  selectedId,
  onSelect,
  onMove,
}: BuilderCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);

  const canvasW = widthCm  * CM_TO_PX;
  const canvasH = heightCm * CM_TO_PX;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, item: CanvasItem) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item.id) return;
      onSelect(item.id);

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDragging({
        id:      item.id,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      });
    },
    [onSelect],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !canvasRef.current) return;
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const xPx = e.clientX - canvasRect.left - dragging.offsetX;
      const yPx = e.clientY - canvasRect.top  - dragging.offsetY;
      onMove(dragging.id, xPx / CM_TO_PX, yPx / CM_TO_PX);
    },
    [dragging, onMove],
  );

  const handleMouseUp = useCallback(() => setDragging(null), []);

  const sortedItems = [...items].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="flex items-center justify-center w-full h-full bg-muted/30 overflow-auto p-4">
      {/* Canvas surface */}
      <div
        ref={canvasRef}
        className="relative bg-white border-2 border-dashed border-border shadow-md select-none"
        style={{ width: canvasW, height: canvasH, flexShrink: 0 }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={() => onSelect(null)}
        data-testid="builder-canvas"
      >
        {sortedItems.map((item) => {
          const isSelected = item.id === selectedId;
          return (
            <div
              key={item.id ?? item.zIndex}
              className={`absolute cursor-grab active:cursor-grabbing border-2 transition-colors ${
                isSelected ? 'border-primary' : 'border-transparent hover:border-primary/40'
              }`}
              style={{
                left:      item.xCm * CM_TO_PX,
                top:       item.yCm * CM_TO_PX,
                width:     item.widthCm  * CM_TO_PX,
                height:    item.heightCm * CM_TO_PX,
                transform: `rotate(${item.rotation}deg) scaleX(${item.flipH ? -1 : 1}) scaleY(${item.flipV ? -1 : 1})`,
                zIndex:    item.zIndex,
              }}
              onMouseDown={(e) => handleMouseDown(e, item)}
            >
              <img
                src={item.assetUrl}
                alt=""
                draggable={false}
                className="w-full h-full object-contain pointer-events-none"
              />
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <p className="text-sm">Upload images from the panel →</p>
          </div>
        )}
      </div>
    </div>
  );
}
