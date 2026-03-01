/**
 * BuilderToolbar.tsx
 * P3-03 — Top toolbar: selected item controls + undo hint
 */

import type { CanvasItem } from '@/data/builder.api';
import { FlipHorizontal2, FlipVertical2, RotateCw, Trash2, MoveUp, MoveDown } from 'lucide-react';

type BuilderToolbarProps = {
  selected:  CanvasItem | null;
  onDelete:  () => void;
  onRotate:  (deg: number) => void;
  onFlipH:   () => void;
  onFlipV:   () => void;
  onZUp:     () => void;
  onZDown:   () => void;
};

function ToolBtn({
  onClick,
  title,
  children,
  danger,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded hover:bg-accent transition-colors ${danger ? 'hover:bg-destructive/10 hover:text-destructive' : ''}`}
    >
      {children}
    </button>
  );
}

export function BuilderToolbar({
  selected,
  onDelete,
  onRotate,
  onFlipH,
  onFlipV,
  onZUp,
  onZDown,
}: BuilderToolbarProps) {
  return (
    <div className="flex items-center h-10 border-b bg-card px-2 gap-1">
      {selected ? (
        <>
          <span className="text-xs text-muted-foreground mr-2 hidden sm:block">Item controls:</span>

          <ToolBtn onClick={() => onRotate(-15)} title="Rotate -15°">
            <RotateCw size={15} className="rotate-180" />
          </ToolBtn>
          <ToolBtn onClick={() => onRotate(15)} title="Rotate +15°">
            <RotateCw size={15} />
          </ToolBtn>

          <div className="w-px h-5 bg-border mx-1" />

          <ToolBtn onClick={onFlipH} title="Flip horizontal">
            <FlipHorizontal2 size={15} />
          </ToolBtn>
          <ToolBtn onClick={onFlipV} title="Flip vertical">
            <FlipVertical2 size={15} />
          </ToolBtn>

          <div className="w-px h-5 bg-border mx-1" />

          <ToolBtn onClick={onZUp} title="Bring forward">
            <MoveUp size={15} />
          </ToolBtn>
          <ToolBtn onClick={onZDown} title="Send backward">
            <MoveDown size={15} />
          </ToolBtn>

          <div className="w-px h-5 bg-border mx-1" />

          <ToolBtn onClick={onDelete} title="Delete item" danger>
            <Trash2 size={15} />
          </ToolBtn>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">
          Select an item on the canvas to edit it
        </span>
      )}
    </div>
  );
}
