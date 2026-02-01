// src/components/editor2d/UVCanvas.tsx
import { useRef, useEffect } from 'react';
import { useUVEditor } from './useUVEditor';
import { OverlayBox } from './OverlayBox';
import { useConfiguratorStore } from '@/stores';
import { useI18n } from '@/hooks';
import type { ZoneKey, ZoneDraft } from '@/types';

interface UVCanvasProps {
  className?: string;
}

export function UVCanvas({ className = '' }: UVCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  // Get state from store
  const zones = useConfiguratorStore((s) => s.zones);
  const activeZoneKey = useConfiguratorStore((s) => s.activeZoneKey);
  const printZoneCM = useConfiguratorStore((s) => s.printZoneCM);
  const currentImage = useConfiguratorStore((s) => s.currentImage);
  const currentPlacement = useConfiguratorStore((s) => s.currentPlacement);
  const zoneDrafts = useConfiguratorStore((s) => s.zoneDrafts);

  // Get actions from store
  const setPlacement = useConfiguratorStore((s) => s.setPlacement);

  // Build zone drafts map for 'all' view
  const zoneDraftsMap: Record<ZoneKey, ZoneDraft> | undefined = zoneDrafts
    ? (Object.fromEntries(zoneDrafts) as Record<ZoneKey, ZoneDraft>)
    : undefined;

  // Convert zones Map to Record
  const zonesRecord: Record<ZoneKey, any> | null = zones
    ? (Object.fromEntries(zones) as Record<ZoneKey, any>)
    : null;

  // Initialize UV editor
  const {
    draw,
    getBoxRect,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useUVEditor({
    canvasRef,
    containerRef,
    zones: zonesRecord,
    activeZoneKey,
    printZoneCM,
    currentImage,
    currentPlacement,
    zoneDrafts: zoneDraftsMap,
    onPlacementChange: setPlacement,
  });

  // Redraw when dependencies change
  useEffect(() => {
    draw();
  }, [
    draw,
    zones,
    activeZoneKey,
    printZoneCM,
    currentImage,
    currentPlacement,
    zoneDrafts,
  ]);

  const hasImage = !!currentImage;
  const hasPlacement = !!currentPlacement;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Resize handles overlay */}
      <OverlayBox
        containerRef={containerRef}
        getBoxRect={getBoxRect}
      />

      {/* Empty state hint */}
      {!hasImage && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center p-4 bg-background/80 backdrop-blur rounded-lg border border-border">
            <p className="text-muted-foreground text-sm">
              {t('editor.uploadHint')}
            </p>
          </div>
        </div>
      )}

      {/* Placement hint */}
      {hasImage && !hasPlacement && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="px-3 py-1.5 bg-card/90 backdrop-blur rounded-full text-xs text-muted-foreground border border-border">
            {t('editor.placeHint')}
          </div>
        </div>
      )}

      {/* Drag hint */}
      {hasImage && hasPlacement && activeZoneKey !== 'all' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="px-3 py-1.5 bg-card/90 backdrop-blur rounded-full text-xs text-muted-foreground border border-border">
            {t('editor.dragHint')}
          </div>
        </div>
      )}

      {/* Zone indicator */}
      <div className="absolute top-3 left-3 pointer-events-none">
        <div className="px-2 py-1 bg-primary/10 backdrop-blur rounded text-xs font-medium text-primary uppercase">
          {activeZoneKey === 'all' ? t('zones.all') : t(`zones.${activeZoneKey}`)}
        </div>
      </div>
    </div>
  );
}
