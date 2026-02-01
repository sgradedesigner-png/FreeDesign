// src/components/editor2d/useUVEditor.ts
import { useRef, useCallback, useEffect } from 'react';
import {
  clamp,
  getDPR,
  getCanvasCoords,
  getTouchDistance,
  uvToWorldPx,
  worldPxToUV,
  worldToCanvas,
  canvasToWorld,
} from '@/utils/canvas';
import {
  getSafeRectRel,
  isPlacementInsideSafe,
  clampPlacementToZone,
} from '@/utils/safeZone';
import type { ZoneKey, ZoneRect, ZoneCM, Placement, ZoneDraft } from '@/types';

export interface UseUVEditorOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  zones: Record<ZoneKey, ZoneRect> | null;
  activeZoneKey: ZoneKey | 'all';
  printZoneCM: ZoneCM | null;
  currentImage: HTMLImageElement | null;
  currentPlacement: Placement | null;
  zoneDrafts?: Record<ZoneKey, ZoneDraft>;
  onPlacementChange?: (placement: Placement) => void;
  onApplyDecal?: () => void;
}

interface ViewTransform {
  enabled: boolean;
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface TemplateMetrics {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useUVEditor(options: UseUVEditorOptions) {
  const {
    canvasRef,
    containerRef,
    zones,
    activeZoneKey,
    printZoneCM,
    currentImage,
    currentPlacement,
    zoneDrafts,
    onPlacementChange,
    onApplyDecal,
  } = options;

  const viewRef = useRef<ViewTransform>({
    enabled: false,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  const metricsRef = useRef<TemplateMetrics>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const draggingRef = useRef(false);
  const lastTouchDistRef = useRef(0);

  /**
   * Check if dark mode is active
   */
  const isDarkMode = useCallback((): boolean => {
    return document.documentElement.classList.contains('dark');
  }, []);

  /**
   * Resize canvas for DPR
   */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = getDPR();
    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }, [canvasRef, containerRef]);

  /**
   * Compute template metrics for centering
   */
  const computeTemplateMetrics = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cw = canvas.width;
    const ch = canvas.height;

    // Use a fixed aspect ratio for the template area
    const tplAspect = 0.75; // width/height ratio
    const tplW = Math.min(cw, ch * tplAspect);
    const tplH = tplW / tplAspect;

    metricsRef.current = {
      x: (cw - tplW) * 0.5,
      y: (ch - tplH) * 0.5,
      width: tplW,
      height: tplH,
    };
  }, [canvasRef]);

  /**
   * Compute view transform for active zone
   */
  const computeViewTransform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !zones) {
      viewRef.current = { enabled: false, scale: 1, offsetX: 0, offsetY: 0 };
      return;
    }

    if (activeZoneKey === 'all') {
      viewRef.current = { enabled: false, scale: 1, offsetX: 0, offsetY: 0 };
      return;
    }

    const zone = zones[activeZoneKey];
    if (!zone) {
      viewRef.current = { enabled: false, scale: 1, offsetX: 0, offsetY: 0 };
      return;
    }

    const { x: tplX, y: tplY, width: tplW, height: tplH } = metricsRef.current;
    if (tplW <= 0 || tplH <= 0) return;

    const padPx = 24;
    const x0 = tplX + zone.uMin * tplW;
    const x1 = tplX + zone.uMax * tplW;
    const y0 = tplY + (1 - zone.vMax) * tplH;
    const y1 = tplY + (1 - zone.vMin) * tplH;

    const zw = Math.max(1, x1 - x0);
    const zh = Math.max(1, y1 - y0);

    const cw = canvas.width;
    const ch = canvas.height;

    const sx = (cw - padPx * 2) / zw;
    const sy = (ch - padPx * 2) / zh;
    const s = Math.min(sx, sy);

    const drawW = zw * s;
    const drawH = zh * s;

    viewRef.current = {
      enabled: true,
      scale: s,
      offsetX: (cw - drawW) * 0.5 - x0 * s,
      offsetY: (ch - drawH) * 0.5 - y0 * s,
    };
  }, [canvasRef, zones, activeZoneKey]);

  /**
   * Convert UV to world pixel coordinates
   */
  const uvToWorld = useCallback(
    (u: number, v: number): { x: number; y: number } => {
      const { x, y, width, height } = metricsRef.current;
      return uvToWorldPx(u, v, x, y, width, height);
    },
    []
  );

  /**
   * Convert zone outline to world path
   */
  const zoneOutlineToPath = useCallback(
    (zone: ZoneRect): Array<{ x: number; y: number }> | null => {
      if (!zone.outline || zone.outline.length < 3) return null;

      return zone.outline.map((p) => {
        const flippedV = zone.vMin + zone.vMax - p.v;
        return uvToWorld(p.u, flippedV);
      });
    },
    [uvToWorld]
  );

  /**
   * Draw zone backdrop
   */
  const drawBackdrop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const isDark = isDarkMode();
    const view = viewRef.current;

    // Clear and fill background
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = isDark ? '#0f172a' : '#F1F5F9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (!zones) return;

    ctx.save();
    if (view.enabled) {
      ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
    }

    // Draw each zone
    Object.entries(zones).forEach(([key, zone]) => {
      if (!zone) return;

      const isActive = activeZoneKey === key;
      const isAllView = activeZoneKey === 'all';

      if (!isAllView && !isActive) return;

      // Try to get outline path, fallback to rectangle
      let path = zoneOutlineToPath(zone);
      if (!path) {
        // Create fallback rectangle from UV bounds
        const p1 = uvToWorld(zone.uMin, zone.vMax);
        const p2 = uvToWorld(zone.uMax, zone.vMax);
        const p3 = uvToWorld(zone.uMax, zone.vMin);
        const p4 = uvToWorld(zone.uMin, zone.vMin);
        path = [p1, p2, p3, p4];
      }

      // Draw zone fill
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.closePath();

      ctx.fillStyle = isDark ? '#334155' : '#ffffff';
      ctx.fill();

      // Draw zone stroke
      if (isActive) {
        ctx.strokeStyle = isDark ? '#38bdf8' : 'rgba(0,140,255,1)';
        ctx.lineWidth = 2 / Math.max(1e-6, view.scale);
      } else {
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1 / Math.max(1e-6, view.scale);
      }
      ctx.stroke();

      // Draw zone label
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
      ctx.font = `bold ${14 / Math.max(1e-6, view.scale)}px sans-serif`;
      ctx.fillText(key.toUpperCase(), path[0].x, path[0].y - 5);

      // Draw blocker outline (neck area)
      if (zone.blockerOutline && zone.blockerOutline.length > 2) {
        const blockerPath = zone.blockerOutline.map((p) => {
          const flippedV = zone.vMin + zone.vMax - p.v;
          return uvToWorld(p.u, flippedV);
        });

        ctx.beginPath();
        ctx.moveTo(blockerPath[0].x, blockerPath[0].y);
        for (let i = 1; i < blockerPath.length; i++) {
          ctx.lineTo(blockerPath[i].x, blockerPath[i].y);
        }
        ctx.closePath();

        ctx.fillStyle = isDark ? '#000000' : 'rgba(20, 20, 20, 0.9)';
        ctx.fill();

        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2 / Math.max(1e-6, view.scale);
        ctx.stroke();
      }
    });

    // Draw center dot for active zone
    if (activeZoneKey !== 'all') {
      const activeZone = zones[activeZoneKey];
      if (activeZone) {
        const uc = (activeZone.uMin + activeZone.uMax) * 0.5;
        const vc = (activeZone.vMin + activeZone.vMax) * 0.5;
        const p = uvToWorld(uc, vc);

        ctx.fillStyle = 'red';
        const r = 6 / Math.max(1e-6, view.scale);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }, [canvasRef, zones, activeZoneKey, isDarkMode, zoneOutlineToPath, uvToWorld]);

  /**
   * Draw safe zone overlay
   */
  const drawSafeOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !zones || !printZoneCM) return;

    if (activeZoneKey === 'all') return;

    const zone = zones[activeZoneKey];
    if (!zone) return;

    const { x: tplX, y: tplY, width: tplW, height: tplH } = metricsRef.current;
    if (tplW <= 0 || tplH <= 0) return;

    const safe = getSafeRectRel(activeZoneKey, printZoneCM);
    const view = viewRef.current;

    const zoneX = tplX + zone.uMin * tplW;
    const zoneY = tplY + (1 - zone.vMax) * tplH;
    const zoneW = (zone.uMax - zone.uMin) * tplW;
    const zoneH = (zone.vMax - zone.vMin) * tplH;

    const safeX = zoneX + safe.uMin * zoneW;
    const safeY = zoneY + safe.vMin * zoneH;
    const safeW = (safe.uMax - safe.uMin) * zoneW;
    const safeH = (safe.vMax - safe.vMin) * zoneH;

    ctx.save();
    if (view.enabled) {
      ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
    }

    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2 / Math.max(1e-6, view.scale);
    ctx.strokeStyle = 'rgba(0,170,90,1)';
    ctx.strokeRect(safeX, safeY, safeW, safeH);

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(0,170,90,1)';
    ctx.font = `${12 / Math.max(1e-6, view.scale)}px ui-monospace,monospace`;
    ctx.fillText('SAFE AREA', safeX + 8 / view.scale, safeY + 16 / view.scale);

    ctx.restore();
  }, [canvasRef, zones, activeZoneKey, printZoneCM]);

  /**
   * Get placement world coordinates
   */
  const placementToWorld = useCallback(
    (
      p: Placement,
      zoneKey: ZoneKey
    ): {
      cx: number;
      cy: number;
      dw: number;
      dh: number;
      zoneWorld: { x: number; y: number; w: number; h: number };
    } => {
      const { x: tplX, y: tplY, width: tplW, height: tplH } = metricsRef.current;
      const zone = zones?.[zoneKey];

      if (!zone) {
        const c = uvToWorld(p.u, p.v);
        return {
          cx: c.x,
          cy: c.y,
          dw: p.uScale * tplW,
          dh: p.vScale * tplW,
          zoneWorld: { x: tplX, y: tplY, w: tplW, h: tplH },
        };
      }

      const uAbs = zone.uMin + p.u * (zone.uMax - zone.uMin);
      const vAbs = zone.vMax - p.v * (zone.vMax - zone.vMin);
      const c = uvToWorld(uAbs, vAbs);

      const zoneWpx = (zone.uMax - zone.uMin) * tplW;
      const dw = p.uScale * zoneWpx;
      const dh = p.vScale * zoneWpx;

      const zoneX = tplX + zone.uMin * tplW;
      const zoneY = tplY + (1 - zone.vMax) * tplH;
      const zoneW = (zone.uMax - zone.uMin) * tplW;
      const zoneH = (zone.vMax - zone.vMin) * tplH;

      return { cx: c.x, cy: c.y, dw, dh, zoneWorld: { x: zoneX, y: zoneY, w: zoneW, h: zoneH } };
    },
    [zones, uvToWorld]
  );

  /**
   * Draw single artwork
   *
   * DESIGN NOTE: 2D Canvas does NOT display rotation.
   * --------------------------------------------------
   * The 2D editor always shows artwork without rotation (straight/upright).
   * Rotation is stored in placement.rotationRad and applied ONLY in the 3D view.
   *
   * This is intentional for arm zones:
   * - Arm zones have a `correctionRad` (±25°) to compensate for sleeve angle
   * - When user uploads an image, we set `rotationRad = -correctionRad` so the
   *   artwork appears upright on the 3D model's angled sleeve
   * - But in 2D editor, we want the user to see their artwork straight/unrotated
   *   for easier editing
   *
   * The rotation IS saved in export data and used by the 3D decal system.
   * See: useMultiDecalSystem.ts for 3D rotation application
   * See: artworkSlice.ts centerAndFit() for initial rotation calculation
   */
  const drawArtwork = useCallback(
    (p: Placement, img: HTMLImageElement, zoneKey: ZoneKey) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const zone = zones?.[zoneKey];
      if (!canvas || !ctx || !zone) return;

      const { cx, cy, dw, dh, zoneWorld } = placementToWorld(p, zoneKey);
      const view = viewRef.current;

      ctx.save();

      // Clip to zone
      ctx.beginPath();
      ctx.rect(zoneWorld.x, zoneWorld.y, zoneWorld.w, zoneWorld.h);
      ctx.clip();

      // Draw image WITHOUT rotation - rotation is only applied in 3D view
      // See comment above for detailed explanation
      ctx.translate(cx, cy);
      // ctx.rotate(p.rotationRad || 0); // DISABLED: rotation not shown in 2D
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);

      // Draw border
      const isAll = activeZoneKey === 'all';
      ctx.strokeStyle = '#00FFFF';
      ctx.lineWidth = (isAll ? 1.5 : 2.5) / Math.max(1e-6, view.scale);
      ctx.strokeRect(-dw / 2, -dh / 2, dw, dh);

      ctx.restore();
    },
    [canvasRef, zones, activeZoneKey, placementToWorld]
  );

  /**
   * Draw warning overlay when outside safe area
   */
  const drawWarning = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !currentPlacement || !printZoneCM) return;
    if (activeZoneKey === 'all') return;

    const safe = getSafeRectRel(activeZoneKey, printZoneCM);
    const isInside = isPlacementInsideSafe(currentPlacement, safe);

    if (!isInside) {
      const { zoneWorld } = placementToWorld(currentPlacement, activeZoneKey);
      const view = viewRef.current;

      ctx.save();
      if (view.enabled) {
        ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
      }

      ctx.globalAlpha = 0.12;
      ctx.fillStyle = 'rgba(255,0,0,1)';
      ctx.fillRect(zoneWorld.x, zoneWorld.y, zoneWorld.w, zoneWorld.h);

      ctx.restore();
    }
  }, [canvasRef, currentPlacement, printZoneCM, activeZoneKey, placementToWorld]);

  /**
   * Main draw function
   */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    resizeCanvas();
    computeTemplateMetrics();
    computeViewTransform();

    // Debug: log zones info
    if (zones) {
      console.log('[UVEditor.draw] zones:', Object.keys(zones), 'activeZone:', activeZoneKey);
    } else {
      console.log('[UVEditor.draw] zones is null');
    }

    drawBackdrop();
    drawSafeOverlay();

    const view = viewRef.current;
    ctx.save();
    if (view.enabled) {
      ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
    }

    // Draw artwork(s)
    if (activeZoneKey === 'all' && zoneDrafts) {
      (['front', 'back', 'left_arm', 'right_arm'] as ZoneKey[]).forEach((zoneKey) => {
        const draft = zoneDrafts[zoneKey];
        if (draft?.image && draft?.placement) {
          drawArtwork(draft.placement, draft.image, zoneKey);
        }
      });
    } else if (currentImage && currentPlacement && activeZoneKey !== 'all') {
      drawArtwork(currentPlacement, currentImage, activeZoneKey);
    }

    ctx.restore();

    drawWarning();
  }, [
    canvasRef,
    resizeCanvas,
    computeTemplateMetrics,
    computeViewTransform,
    drawBackdrop,
    drawSafeOverlay,
    drawArtwork,
    drawWarning,
    activeZoneKey,
    zoneDrafts,
    currentImage,
    currentPlacement,
  ]);

  /**
   * Convert canvas coordinates to placement UV
   */
  const canvasToPlacementUV = useCallback(
    (xCanvas: number, yCanvas: number): { u: number; v: number } => {
      const view = viewRef.current;
      const { x: tplX, y: tplY, width: tplW, height: tplH } = metricsRef.current;

      // Convert to world coordinates
      const world = view.enabled
        ? canvasToWorld(xCanvas, yCanvas, view.scale, view.offsetX, view.offsetY)
        : { x: xCanvas, y: yCanvas };

      // Convert to absolute UV
      const absUV = worldPxToUV(world.x, world.y, tplX, tplY, tplW, tplH);

      if (activeZoneKey === 'all') {
        return absUV;
      }

      const zone = zones?.[activeZoneKey];
      if (!zone) return absUV;

      // Convert to relative UV within zone
      const uRel = (absUV.u - zone.uMin) / Math.max(1e-6, zone.uMax - zone.uMin);
      const vRel = (zone.vMax - absUV.v) / Math.max(1e-6, zone.vMax - zone.vMin);

      return {
        u: clamp(uRel, 0, 1),
        v: clamp(vRel, 0, 1),
      };
    },
    [zones, activeZoneKey]
  );

  /**
   * Check if point is inside artwork
   */
  const isPointInsideArtwork = useCallback(
    (xCanvas: number, yCanvas: number): boolean => {
      if (!currentPlacement || activeZoneKey === 'all') return false;

      const w = placementToWorld(currentPlacement, activeZoneKey);
      const view = viewRef.current;
      const c = view.enabled
        ? worldToCanvas(w.cx, w.cy, view.scale, view.offsetX, view.offsetY)
        : { x: w.cx, y: w.cy };

      const halfW = (w.dw * view.scale) / 2;
      const halfH = (w.dh * view.scale) / 2;

      return (
        xCanvas >= c.x - halfW &&
        xCanvas <= c.x + halfW &&
        yCanvas >= c.y - halfH &&
        yCanvas <= c.y + halfH
      );
    },
    [currentPlacement, activeZoneKey, placementToWorld]
  );

  /**
   * Handle pointer down
   */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (activeZoneKey === 'all') return;
      if (!currentPlacement) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const { x, y } = getCanvasCoords(canvas, e.clientX, e.clientY);

      if (isPointInsideArtwork(x, y)) {
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        draggingRef.current = true;
      }
    },
    [canvasRef, activeZoneKey, currentPlacement, isPointInsideArtwork]
  );

  /**
   * Handle pointer move
   */
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!draggingRef.current || !currentPlacement) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const { x, y } = getCanvasCoords(canvas, e.clientX, e.clientY);
      const uv = canvasToPlacementUV(x, y);

      const newPlacement = clampPlacementToZone({
        ...currentPlacement,
        u: uv.u,
        v: uv.v,
      });

      onPlacementChange?.(newPlacement);
      onApplyDecal?.();
      draw();
    },
    [canvasRef, currentPlacement, canvasToPlacementUV, onPlacementChange, onApplyDecal, draw]
  );

  /**
   * Handle pointer up
   */
  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  /**
   * Handle touch start (for pinch zoom)
   */
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      lastTouchDistRef.current = getTouchDistance(e.touches[0], e.touches[1]);
    }
  }, []);

  /**
   * Handle touch move (for pinch zoom)
   */
  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (e.touches.length !== 2 || !currentPlacement) return;

      e.preventDefault();
      e.stopPropagation();

      const dist = getTouchDistance(e.touches[0], e.touches[1]);

      if (lastTouchDistRef.current > 0) {
        const zoomSpeed = 0.05;
        const factor = dist > lastTouchDistRef.current ? 1 + zoomSpeed : 1 - zoomSpeed;

        const newPlacement = clampPlacementToZone({
          ...currentPlacement,
          uScale: clamp(currentPlacement.uScale * factor, 0.05, 1.2),
          vScale: clamp(currentPlacement.vScale * factor, 0.05, 1.2),
        });

        onPlacementChange?.(newPlacement);
        onApplyDecal?.();
        draw();
      }

      lastTouchDistRef.current = dist;
    },
    [currentPlacement, onPlacementChange, onApplyDecal, draw]
  );

  /**
   * Handle touch end
   */
  const handleTouchEnd = useCallback(() => {
    lastTouchDistRef.current = 0;
  }, []);

  /**
   * Handle wheel scroll for zoom
   */
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!currentPlacement || activeZoneKey === 'all') return;

      e.preventDefault();

      const zoomSpeed = 0.001;
      const delta = -e.deltaY * zoomSpeed;
      const factor = 1 + delta;

      const newPlacement = {
        ...currentPlacement,
        uScale: clamp(currentPlacement.uScale * factor, 0.05, 1.2),
        vScale: clamp(currentPlacement.vScale * factor, 0.05, 1.2),
      };

      onPlacementChange?.(newPlacement);
      onApplyDecal?.();
      draw();
    },
    [currentPlacement, activeZoneKey, onPlacementChange, onApplyDecal, draw]
  );

  // Add wheel event listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Redraw on resize
  useEffect(() => {
    const handleResize = () => {
      draw();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  // Initial draw
  useEffect(() => {
    draw();
  }, [draw]);

  /**
   * Get artwork bounding box in screen coordinates (for OverlayBox)
   */
  const getBoxRect = useCallback((): { x: number; y: number; width: number; height: number } | null => {
    if (!currentPlacement || activeZoneKey === 'all') return null;

    const container = containerRef.current;
    if (!container) return null;

    const view = viewRef.current;
    const { cx, cy, dw, dh } = placementToWorld(currentPlacement, activeZoneKey);

    // Apply view transform
    let screenX: number, screenY: number, screenW: number, screenH: number;

    if (view.enabled) {
      screenX = cx * view.scale + view.offsetX;
      screenY = cy * view.scale + view.offsetY;
      screenW = dw * view.scale;
      screenH = dh * view.scale;
    } else {
      screenX = cx;
      screenY = cy;
      screenW = dw;
      screenH = dh;
    }

    // Convert from canvas coordinates to CSS pixels (account for DPR)
    const dpr = getDPR();
    screenX /= dpr;
    screenY /= dpr;
    screenW /= dpr;
    screenH /= dpr;

    return {
      x: screenX - screenW / 2,
      y: screenY - screenH / 2,
      width: screenW,
      height: screenH,
    };
  }, [containerRef, currentPlacement, activeZoneKey, placementToWorld]);

  return {
    draw,
    getBoxRect,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
