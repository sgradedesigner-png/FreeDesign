// src/components/editor2d/OverlayBox.tsx
import { useRef, useEffect, useState } from 'react';
import { useConfiguratorStore } from '@/stores';
import type { Placement } from '@/types';

type HandlePosition =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'
  | 'rotate';

interface OverlayBoxProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Template metrics from useUVEditor */
  getBoxRect: () => { x: number; y: number; width: number; height: number } | null;
  className?: string;
}

const HANDLE_SIZE = 10;
const ROTATE_HANDLE_OFFSET = 24;

const cursorMap: Record<HandlePosition, string> = {
  'top-left': 'nwse-resize',
  'top': 'ns-resize',
  'top-right': 'nesw-resize',
  'right': 'ew-resize',
  'bottom-right': 'nwse-resize',
  'bottom': 'ns-resize',
  'bottom-left': 'nesw-resize',
  'left': 'ew-resize',
  'rotate': 'grab',
};

export function OverlayBox({ containerRef, getBoxRect, className = '' }: OverlayBoxProps) {
  const activeZoneKey = useConfiguratorStore((s) => s.activeZoneKey);
  const currentImage = useConfiguratorStore((s) => s.currentImage);
  const currentPlacement = useConfiguratorStore((s) => s.currentPlacement);
  const setPlacement = useConfiguratorStore((s) => s.setPlacement);

  const [boxRect, setBoxRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const draggingHandle = useRef<HandlePosition | null>(null);
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startPlacement = useRef<Placement | null>(null);

  // Update box rect when placement, image, or active zone changes
  useEffect(() => {
    const updateRect = () => {
      const rect = getBoxRect();
      setBoxRect(rect);
    };

    // Immediate update
    updateRect();

    // Use requestAnimationFrame to ensure canvas has rendered before updating
    // This fixes the issue where handles appear at wrong position when switching zones
    let rafId1: number | null = null;
    let rafId2: number | null = null;

    rafId1 = requestAnimationFrame(() => {
      updateRect();
      // Second RAF to ensure view transform is fully updated
      rafId2 = requestAnimationFrame(updateRect);
    });

    // Update on resize
    window.addEventListener('resize', updateRect);
    return () => {
      if (rafId1 !== null) cancelAnimationFrame(rafId1);
      if (rafId2 !== null) cancelAnimationFrame(rafId2);
      window.removeEventListener('resize', updateRect);
    };
  }, [getBoxRect, currentPlacement, activeZoneKey, currentImage]);

  // Don't show if no image or in 'all' view
  if (!currentImage || !currentPlacement || activeZoneKey === 'all' || !boxRect) {
    return null;
  }

  const { x, y, width, height } = boxRect;

  /**
   * DESIGN NOTE: OverlayBox does NOT display rotation.
   * --------------------------------------------------
   * The 2D editor always shows artwork without rotation (straight/upright).
   * Rotation is stored in placement.rotationRad and applied ONLY in 3D view.
   *
   * This is intentional for arm zones where correctionRad (±25°) compensates
   * for sleeve angle. Users see their artwork straight in 2D for easier editing,
   * but it renders correctly rotated on the 3D model.
   *
   * See: useUVEditor.ts drawArtwork() for matching implementation
   */
  // const rotation = (currentPlacement.rotationRad || 0) * (180 / Math.PI); // DISABLED

  const handleMouseDown = (e: React.MouseEvent, handle: HandlePosition) => {
    e.preventDefault();
    e.stopPropagation();

    draggingHandle.current = handle;
    startPos.current = { x: e.clientX, y: e.clientY };
    startPlacement.current = { ...currentPlacement };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!draggingHandle.current || !startPlacement.current) return;

    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    const handle = draggingHandle.current;

    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const scaleFactor = 0.002; // Adjust sensitivity

    let newPlacement = { ...startPlacement.current };

    if (handle === 'rotate') {
      // Calculate rotation based on mouse position relative to center
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const mouseX = e.clientX - containerRect.left;
      const mouseY = e.clientY - containerRect.top;

      const angle = Math.atan2(mouseY - centerY, mouseX - centerX) + Math.PI / 2;
      newPlacement.rotationRad = angle;
    } else {
      // Handle resize
      const aspectRatio = currentImage.naturalWidth / currentImage.naturalHeight;

      switch (handle) {
        case 'top-left':
          newPlacement.uScale = Math.max(0.05, Math.min(1.2, startPlacement.current.uScale - dx * scaleFactor));
          newPlacement.vScale = newPlacement.uScale / aspectRatio;
          break;
        case 'top-right':
          newPlacement.uScale = Math.max(0.05, Math.min(1.2, startPlacement.current.uScale + dx * scaleFactor));
          newPlacement.vScale = newPlacement.uScale / aspectRatio;
          break;
        case 'bottom-left':
          newPlacement.uScale = Math.max(0.05, Math.min(1.2, startPlacement.current.uScale - dx * scaleFactor));
          newPlacement.vScale = newPlacement.uScale / aspectRatio;
          break;
        case 'bottom-right':
          newPlacement.uScale = Math.max(0.05, Math.min(1.2, startPlacement.current.uScale + dx * scaleFactor));
          newPlacement.vScale = newPlacement.uScale / aspectRatio;
          break;
        case 'top':
        case 'bottom':
          const dyScale = handle === 'top' ? -dy : dy;
          newPlacement.vScale = Math.max(0.05, Math.min(1.2, startPlacement.current.vScale + dyScale * scaleFactor));
          break;
        case 'left':
        case 'right':
          const dxScale = handle === 'left' ? -dx : dx;
          newPlacement.uScale = Math.max(0.05, Math.min(1.2, startPlacement.current.uScale + dxScale * scaleFactor));
          break;
      }
    }

    setPlacement(newPlacement);
  };

  const handleMouseUp = () => {
    draggingHandle.current = null;
    startPlacement.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Handle positions
  const handles: { position: HandlePosition; style: React.CSSProperties }[] = [
    // Corners
    {
      position: 'top-left',
      style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 }
    },
    {
      position: 'top-right',
      style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 }
    },
    {
      position: 'bottom-left',
      style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 }
    },
    {
      position: 'bottom-right',
      style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 }
    },
    // Edges
    {
      position: 'top',
      style: { top: -HANDLE_SIZE / 2, left: '50%', transform: 'translateX(-50%)' }
    },
    {
      position: 'bottom',
      style: { bottom: -HANDLE_SIZE / 2, left: '50%', transform: 'translateX(-50%)' }
    },
    {
      position: 'left',
      style: { top: '50%', left: -HANDLE_SIZE / 2, transform: 'translateY(-50%)' }
    },
    {
      position: 'right',
      style: { top: '50%', right: -HANDLE_SIZE / 2, transform: 'translateY(-50%)' }
    },
  ];

  return (
    <div
      className={`absolute pointer-events-none ${className}`}
      style={{
        left: x,
        top: y,
        width: width,
        height: height,
        // transform: `rotate(${rotation}deg)`, // DISABLED: rotation not shown in 2D
        transformOrigin: 'center center',
      }}
    >
      {/* Border */}
      <div className="absolute inset-0 border-2 border-cyan-400 rounded-sm" />

      {/* Resize handles */}
      {handles.map(({ position, style }) => (
        <div
          key={position}
          className="absolute bg-white border-2 border-cyan-500 rounded-sm pointer-events-auto hover:bg-cyan-100 hover:scale-110 transition-transform"
          style={{
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            cursor: cursorMap[position],
            ...style,
          }}
          onMouseDown={(e) => handleMouseDown(e, position)}
        />
      ))}

      {/* Rotate handle */}
      <div
        className="absolute left-1/2 pointer-events-auto"
        style={{
          top: -ROTATE_HANDLE_OFFSET - HANDLE_SIZE,
          transform: 'translateX(-50%)',
        }}
      >
        {/* Line connecting to box */}
        <div
          className="absolute left-1/2 bg-cyan-400"
          style={{
            width: 2,
            height: ROTATE_HANDLE_OFFSET - HANDLE_SIZE / 2,
            top: HANDLE_SIZE,
            transform: 'translateX(-50%)',
          }}
        />
        {/* Rotate circle */}
        <div
          className="bg-white border-2 border-cyan-500 rounded-full hover:bg-cyan-100 hover:scale-110 transition-transform flex items-center justify-center"
          style={{
            width: HANDLE_SIZE + 4,
            height: HANDLE_SIZE + 4,
            cursor: 'grab',
          }}
          onMouseDown={(e) => handleMouseDown(e, 'rotate')}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-cyan-600"
          >
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </div>
      </div>

      {/* Size label */}
      <div
        className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-black/70 text-white text-xs rounded whitespace-nowrap"
      >
        {Math.round(width)}×{Math.round(height)}
      </div>
    </div>
  );
}
