// src/three/editor/uvCanvas.js
import * as THREE from 'three';
import { cmToPlacementWidth } from './placement.js'; // applySnap хэрэггүй бол хасаж болно
import { clamp } from './clamp.js';
import { getSafeRectRel, isPlacementInsideSafe } from './safeZone.js';

export function setupUVEditor(opts) {
  const {
    artCanvas, artViewport, overlayBox, hud,
    template, zones, getActiveZoneKey, getAllZoneDrafts,
    artworkCtrl, onApplyDecalFromPose,
    // React state-ээс ирэх утгууд
    printZoneCM
  } = opts;

  const ctx = artCanvas?.getContext('2d');
  if (!ctx) return null;

  // Internal state
  let tplX = 0, tplY = 0, tplW = 0, tplH = 0;
  let viewS = 1, viewOX = 0, viewOY = 0;
  let viewEnabled = false;

  // Cleanup хийх функцүүдийн жагсаалт
  const disposers = [];

  // ------------------------------------------------
  // TRANSFORMS & HELPERS
  // ------------------------------------------------

  function setIdentityTransform() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function uvToWorldPx(u, v) {
    const x = tplX + u * tplW;
    const y = tplY + (1 - v) * tplH; 
    return { x, y };
  }

  // ✅ In-place flip logic (Таны хүссэнээр зөв харагддаг logic)
  function zoneOutlineToWorldPath(z) {
    if (!z?.outline || z.outline.length < 3) return null;
    return z.outline.map(p => {
      // V-г эргүүлэх логик
      const flippedV = z.vMin + z.vMax - p.v;
      return uvToWorldPx(p.u, flippedV);
    });
  }

  function setViewTransform() {
    if (!viewEnabled) {
      setIdentityTransform();
      return;
    }
    ctx.setTransform(viewS, 0, 0, viewS, viewOX, viewOY);
  }

  function worldToCanvasPx(x, y) {
    if (!viewEnabled) return { x, y };
    return { x: x * viewS + viewOX, y: y * viewS + viewOY };
  }

  function canvasToWorldPx(x, y) {
    if (!viewEnabled) return { x, y };
    return { x: (x - viewOX) / Math.max(1e-6, viewS), y: (y - viewOY) / Math.max(1e-6, viewS) };
  }

  function worldPxToAbsUV(x, y) {
    const u0 = (x - tplX) / Math.max(1e-6, tplW);
    const v0 = 1 - ((y - tplY) / Math.max(1e-6, tplH));
    return { u: clamp(u0, 0, 1), v: clamp(v0, 0, 1) };
  }

  function canvasPxToAbsUV(xCanvas, yCanvas) {
    const { x, y } = canvasToWorldPx(xCanvas, yCanvas);
    return worldPxToAbsUV(x, y);
  }

  // ------------------------------------------------
  // RESIZE & COMPUTE
  // ------------------------------------------------

  function resizeCanvasDPR() {
    if (!artCanvas || !artViewport) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    
    const availW = artViewport.clientWidth;
    const availH = artViewport.clientHeight;

    // Canvas size sync
    if (artCanvas.width !== Math.round(availW * dpr) || artCanvas.height !== Math.round(availH * dpr)) {
        artCanvas.style.width = `${availW}px`;
        artCanvas.style.height = `${availH}px`;
        artCanvas.width = Math.round(availW * dpr);
        artCanvas.height = Math.round(availH * dpr);
    }
  }

  function drawTemplateContainComputeOnly() {
    const tpl = template?.img;
    if (!tpl) return;

    const cw = artCanvas.width, ch = artCanvas.height;
    const s = Math.min(cw / tpl.width, ch / tpl.height);

    tplW = tpl.width * s;
    tplH = tpl.height * s;
    tplX = (cw - tplW) * 0.5;
    tplY = (ch - tplH) * 0.5;
  }

  function computeZoneViewTransform(z, padPx = 24) {
    const x0 = tplX + z.uMin * tplW;
    const x1 = tplX + z.uMax * tplW;
    const y0 = tplY + (1 - z.vMax) * tplH;
    const y1 = tplY + (1 - z.vMin) * tplH;

    const zw = Math.max(1, x1 - x0);
    const zh = Math.max(1, y1 - y0);
    const cw = artCanvas.width;
    const ch = artCanvas.height;

    const sx = (cw - padPx * 2) / zw;
    const sy = (ch - padPx * 2) / zh;
    const s = Math.min(sx, sy);

    const drawW = zw * s;
    const drawH = zh * s;

    const ox = (cw - drawW) * 0.5 - x0 * s;
    const oy = (ch - drawH) * 0.5 - y0 * s;

    return { s, ox, oy };
  }

  function setViewTransformForActiveZone() {
    const key = getActiveZoneKey?.() || 'front';

    if (key === 'all') {
      viewEnabled = false; 
      viewS = 1; viewOX = 0; viewOY = 0;
      return;
    }

    const z = zones?.[key];
    if (!z || tplW <= 0 || tplH <= 0) {
      viewEnabled = false;
      viewS = 1; viewOX = 0; viewOY = 0;
      return;
    }

    const vt = computeZoneViewTransform(z, 24);
    viewEnabled = true;
    viewS = vt.s;
    viewOX = vt.ox;
    viewOY = vt.oy;
  }

  // ------------------------------------------------
  // DRAWING FUNCTIONS
  // ------------------------------------------------

  function drawZoneCenterDot(z) {
    const uc = (z.uMin + z.uMax) * 0.5;
    const vc = (z.vMin + z.vMax) * 0.5;
    const p = uvToWorldPx(uc, vc);
    ctx.save();
    ctx.fillStyle = 'red';
    const r = 6 / Math.max(1e-6, viewS);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBackdrop() {
    ctx.save();
    setIdentityTransform();
    ctx.clearRect(0, 0, artCanvas.width, artCanvas.height);
    
    // Dark mode check
    const isDark = document.documentElement.classList.contains('dark');

    // Background
    ctx.fillStyle = isDark ? '#0f172a' : '#F1F5F9';  
    ctx.fillRect(0, 0, artCanvas.width, artCanvas.height);
    ctx.restore();

    ctx.save();
    setViewTransform();

    if (zones && tplW > 0 && tplH > 0) {
      Object.entries(zones).forEach(([key, z]) => {
        if (!z) return;

        const currentActive = getActiveZoneKey?.();
        const isActive = (currentActive === key);
        const isAllView = (currentActive === 'all');

        if (!isAllView && !isActive) return;

        const path = zoneOutlineToWorldPath(z);

        if (path) {
          ctx.beginPath();
          ctx.moveTo(path[0].x, path[0].y);
          for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
          ctx.closePath();

          ctx.fillStyle = isDark ? '#334155' : '#ffffff'; 
          ctx.fill();

          if (isActive) {
            ctx.strokeStyle = isDark ? '#38bdf8' : 'rgba(0,140,255,1)';
            ctx.lineWidth = 2 / Math.max(1e-6, viewS);
          } else {
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'; 
            ctx.lineWidth = 1 / Math.max(1e-6, viewS);
          }
          ctx.stroke();

          // Label
          ctx.fillStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
          ctx.font = `bold ${14 / Math.max(1e-6, viewS)}px sans-serif`;
          ctx.fillText(key.toUpperCase(), path[0].x, path[0].y - 5);
        }

        // Blocker (Neck)
        /*if (z.blockerOutline && z.blockerOutline.length > 2) {
            const blockerPath = z.blockerOutline.map(p => {
                const flippedV = z.vMin + z.vMax - p.v; 
                return uvToWorldPx(p.u, flippedV);
            });
            ctx.beginPath();
            ctx.moveTo(blockerPath[0].x, blockerPath[0].y);
            for (let i = 1; i < blockerPath.length; i++) ctx.lineTo(blockerPath[i].x, blockerPath[i].y);
            ctx.closePath();
            
            ctx.fillStyle = isDark ? '#000000' : 'rgba(20, 20, 20, 0.9)';
            ctx.fill();
            
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2 / Math.max(1e-6, viewS);
            ctx.stroke();
        }*/
      });
    }

    const activeKey = getActiveZoneKey?.() || 'front';
    if (activeKey !== 'all') {
        const activeZone = zones?.[activeKey];
        if (activeZone) drawZoneCenterDot(activeZone);
    }

    ctx.restore();
  }

  function drawSafeOverlay() {
    const key = getActiveZoneKey?.() || 'front';
    if (key === 'all') return; 

    const z = zones?.[key];
    if (!z || tplW <= 0 || tplH <= 0) return;

    const safe = getSafeRectRel(key, printZoneCM);
    const zoneX = tplX + z.uMin * tplW;
    const zoneY = tplY + (1 - z.vMax) * tplH;
    const zoneW = (z.uMax - z.uMin) * tplW;
    const zoneH = (z.vMax - z.vMin) * tplH;

    const safeX = zoneX + safe.uMin * zoneW;
    const safeY = zoneY + safe.vMin * zoneH;
    const safeW = (safe.uMax - safe.uMin) * zoneW;
    const safeH = (safe.vMax - safe.vMin) * zoneH;

    ctx.save();
    setViewTransform();

    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2 / Math.max(1e-6, viewS);
    ctx.strokeStyle = 'rgba(0,170,90,1)';
    ctx.strokeRect(safeX, safeY, safeW, safeH);

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(0,170,90,1)';
    ctx.font = `${12 / Math.max(1e-6, viewS)}px ui-monospace,monospace`;
    ctx.fillText('SAFE AREA', safeX + 8 / Math.max(1e-6, viewS), safeY + 16 / Math.max(1e-6, viewS));

    ctx.restore();
  }

  function placementToWorld(p, zoneKeyOverride = null) {
    const key = zoneKeyOverride || getActiveZoneKey?.() || 'front';
    const z = zones?.[key];

    if (!z) {
      const c = uvToWorldPx(p.u, p.v);
      const dw = p.uScale * tplW;
      const dh = p.vScale * tplW;
      return { cx: c.x, cy: c.y, dw, dh, zoneWorld: { x: tplX, y: tplY, w: tplW, h: tplH } };
    }

    // --- OFFSET Logic (Таны тохируулсан) ---
    const vOffset = 0.0; 
    const pV_Adjusted = p.v + vOffset; 
    
    // In-place flip calculation
    const uAbs = z.uMin + p.u * (z.uMax - z.uMin);
    const vAbs = z.vMax - pV_Adjusted * (z.vMax - z.vMin);

    const c = uvToWorldPx(uAbs, vAbs);

    const zoneWpx = (z.uMax - z.uMin) * tplW;
    const dw = p.uScale * zoneWpx;
    const dh = p.vScale * zoneWpx;

    const zoneX = tplX + z.uMin * tplW;
    const zoneY = tplY + (1 - z.vMax) * tplH;
    const zoneW = (z.uMax - z.uMin) * tplW;
    const zoneH = (z.vMax - z.vMin) * tplH;

    return { cx: c.x, cy: c.y, dw, dh, zoneWorld: { x: zoneX, y: zoneY, w: zoneW, h: zoneH } };
  }

  function drawSingleArtwork(p, img, zoneKey) {
    const z = zones?.[zoneKey];
    if (!z) return;

    const { cx, cy, dw, dh, zoneWorld } = placementToWorld(p, zoneKey);

    ctx.save();
    
    // 1. Clipping
    ctx.beginPath();
    ctx.rect(zoneWorld.x, zoneWorld.y, zoneWorld.w, zoneWorld.h);
    ctx.clip();

    // 2. Draw Image
    ctx.translate(cx, cy);
    ctx.rotate(p.rotationRad || 0);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);

    // 3. Border
    const isAll = (getActiveZoneKey?.() === 'all');
    ctx.strokeStyle = isAll ? '#00FFFF' : '#00FFFF';
    ctx.lineWidth = (isAll ? 1.5 : 2.5) / Math.max(1e-6, viewS);
    ctx.strokeRect(-dw / 2, -dh / 2, dw, dh);

    ctx.restore();
  }

  function drawEditor() {
    if (!ctx) return;
    resizeCanvasDPR();
    drawTemplateContainComputeOnly();
    setViewTransformForActiveZone();
    
    drawBackdrop();
    drawSafeOverlay();

    const activeKey = getActiveZoneKey?.() || 'front';

    ctx.save();
    setViewTransform();

    // ✅ "ALL" горим
    if (activeKey === 'all') {
      const drafts = getAllZoneDrafts?.(); 
      if (drafts) {
        ['front', 'back', 'left_arm', 'right_arm'].forEach(zoneKey => {
          const d = drafts[zoneKey];
          if (d && d.image && d.placement) {
            drawSingleArtwork(d.placement, d.image, zoneKey);
          }
        });
      }
    } 
    // ✅ Энгийн горим
    else {
      const p = artworkCtrl.getPlacement?.();
      const img = artworkCtrl.getImage?.();
      if (p && img) {
        drawSingleArtwork(p, img, activeKey);
      }
    }

    ctx.restore();

    // Warning Logic
    if (activeKey !== 'all') {
      const p = artworkCtrl.getPlacement?.();
      // 🔥 ШИНЭ: Зургийг бас авна
      const img = artworkCtrl.getImage?.(); 
      if (p && img) {
        const safe = getSafeRectRel(activeKey, printZoneCM);
        const ok = isPlacementInsideSafe(p, safe);
        if (!ok) {
          const { zoneWorld } = placementToWorld(p);
          ctx.save();
          setViewTransform();
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = 'rgba(255,0,0,1)';
          ctx.fillRect(zoneWorld.x, zoneWorld.y, zoneWorld.w, zoneWorld.h);
          ctx.restore();
          if (hud && !hud.textContent.includes('Outside SAFE')) {
            hud.textContent += `\n⚠ Outside SAFE AREA`;
          }
        }
      }
    }
  }

  // ------------------------------------------------
  // EVENTS
  // ------------------------------------------------

  function bindEditorEvents() {
    let dragging2D = false;

    function getCanvasXY(e) {
      const r = artCanvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * (artCanvas.width / r.width);
      const y = (e.clientY - r.top)  * (artCanvas.height / r.height);
      return { x, y };
    }

    function canvasToPlacement(xCanvas, yCanvas) {
      const key = getActiveZoneKey?.() || 'front';
      const z = zones?.[key];
      const { u: uAbs, v: vAbs } = canvasPxToAbsUV(xCanvas, yCanvas);

      if (!z) return { u: uAbs, v: vAbs };
      const uRel = (uAbs - z.uMin) / Math.max(1e-6, (z.uMax - z.uMin));
      const vRel = (z.vMax - vAbs) / Math.max(1e-6, (z.vMax - z.vMin));
      return { u: clamp(uRel, 0, 1), v: clamp(vRel, 0, 1) };
    }

    function clampPlacementInsideZone(p) {
      const halfW = p.uScale * 0.5;
      const halfH = p.vScale * 0.5;
      const tolerance = 0.001; 
      p.u = clamp(p.u, 0 + halfW - tolerance, 1 - halfW + tolerance);
      p.v = clamp(p.v, 0 + halfH - tolerance, 1 - halfH + tolerance);
      return p;
    }

    function isPointInsideArtwork(xCanvas, yCanvas) {
      const p = artworkCtrl.getPlacement?.();
      if (!p) return false;
      const w = placementToWorld(p);
      const c = worldToCanvasPx(w.cx, w.cy);
      const left = c.x - (w.dw * viewS) / 2;
      const top  = c.y - (w.dh * viewS) / 2;
      return (xCanvas >= left && xCanvas <= left + (w.dw * viewS) &&
              yCanvas >= top  && yCanvas <= top + (w.dh * viewS));
    }

    // --- Mouse / Pointer Events ---
    const onPointerDown = (e) => {
      if (getActiveZoneKey?.() === 'all') return;
      if (!artworkCtrl.hasPlacement?.()) return;
      const { x, y } = getCanvasXY(e);
      if (!isPointInsideArtwork(x, y)) return;
      e.preventDefault();
      artCanvas.setPointerCapture?.(e.pointerId);
      dragging2D = true;
    };

    const onPointerMove = (e) => {
      if (!dragging2D) return;
      const { x, y } = getCanvasXY(e);
      const rel = canvasToPlacement(x, y);
      const p = artworkCtrl.getPlacement();
      if (!p) return;
      
      p.u = rel.u;
      p.v = rel.v;

      clampPlacementInsideZone(p);
      artworkCtrl.setPlacement(p);
      onApplyDecalFromPose?.();
      drawEditor();
    };

    const onPointerUp = () => { dragging2D = false; };

    artCanvas.addEventListener('pointerdown', onPointerDown);
    artCanvas.addEventListener('pointermove', onPointerMove);
    // window дээр тавьж байгаа тул dispose дээр цэвэрлэх хэрэгтэй
    window.addEventListener('pointerup', onPointerUp);
    
    disposers.push(() => {
        artCanvas.removeEventListener('pointerdown', onPointerDown);
        artCanvas.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
    });

    // --- Touch / Zoom Events ---
    let lastTouchDist = 0;

    function getTouchDist(e) {
      return Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }

    const onTouchStart = (e) => {
      if (e.touches.length === 2) lastTouchDist = getTouchDist(e);
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        const dist = getTouchDist(e);
        if (lastTouchDist > 0) {
          const zoomSpeed = 0.05;
          if (dist > lastTouchDist) artworkCtrl.scaleBy(1 + zoomSpeed);
          else if (dist < lastTouchDist) artworkCtrl.scaleBy(1 - zoomSpeed);
          
          const p = artworkCtrl.getPlacement();
          if (p) {
              clampPlacementInsideZone(p);
              artworkCtrl.setPlacement(p);
              onApplyDecalFromPose?.();
              drawEditor();
          }
        }
        lastTouchDist = dist;
      }
    };

    const onTouchEnd = () => { lastTouchDist = 0; };

    artCanvas.addEventListener('touchstart', onTouchStart, { passive: false });
    artCanvas.addEventListener('touchmove', onTouchMove, { passive: false });
    artCanvas.addEventListener('touchend', onTouchEnd);

    disposers.push(() => {
        artCanvas.removeEventListener('touchstart', onTouchStart);
        artCanvas.removeEventListener('touchmove', onTouchMove);
        artCanvas.removeEventListener('touchend', onTouchEnd);
    });
  }

  // --- INIT ---
  resizeCanvasDPR();
  
  const onWindowResize = () => {
    resizeCanvasDPR();
    drawEditor();
  };
  window.addEventListener('resize', onWindowResize);
  disposers.push(() => window.removeEventListener('resize', onWindowResize));

  bindEditorEvents();
  drawEditor();

  // --- RETURN API (with dispose for React) ---
  return {
    drawEditor,
    updateOverlayBox: () => {}, // Overlay логик React талд байвал энийг хоосон үлдээж болно
    setPrintZoneCM(cm) {
      // Configurator.jsx-аас printZoneCM-ийг шинэчлэхэд дуудна
      // (Хэрэв та props-оор дамжуулж байгаа бол initEditorOnce дахиж дуудагдахгүй байж магадгүй тул энд setter байх хэрэгтэй)
    },
    applyWidthCm(widthCm) {
      const p = artworkCtrl.getPlacement();
      const img = artworkCtrl.getImage();
      if (!p || !img) return;
      p.uScale = cmToPlacementWidth(widthCm, printZoneCM);
      const ratio = img.height / Math.max(1e-6, img.width);
      p.vScale = clamp(p.uScale * ratio, 0.05, 1.2);
      artworkCtrl.setPlacement(p);
      onApplyDecalFromPose?.();
      drawEditor();
    },
    // ✅ React useEffect cleanup-д зориулсан функц
    dispose() {
        disposers.forEach(fn => fn());
    }
  };
}