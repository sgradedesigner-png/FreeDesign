// src/print/exportJSON.js
// ✅ React-friendly utilities (browser-only)

/**
 * Build print job JSON
 */
export function buildPrintJobJSON({
  placement,
  printZone,
  printZoneCM,
  dpi,
  templatePx,
  product,
}) {
  return {
    product,
    zone: {
      name: printZone.name,
      cm: printZoneCM,
      uv: {
        uMin: printZone.uMin,
        uMax: printZone.uMax,
        vMin: printZone.vMin,
        vMax: printZone.vMax,
      },
    },
    placement: {
      u: placement.u,
      v: placement.v,
      uScale: placement.uScale,
      vScale: placement.vScale,
      rotationDeg: (placement.rotationRad || 0) * 180 / Math.PI,
    },
    meta: {
      dpi,
      templatePx,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Helper: crop a canvas into a new canvas
 * crop: {x, y, w, h}
 */
export function cropCanvas(srcCanvas, crop) {
  const { x, y, w, h } = crop;

  const outW = Math.max(1, Math.round(w));
  const outH = Math.max(1, Math.round(h));

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;

  const octx = out.getContext("2d");
  if (!octx) {
    throw new Error("[cropCanvas] 2D context not available");
  }

  // drawImage args: source canvas, sx, sy, sw, sh, dx, dy, dw, dh
  octx.drawImage(srcCanvas, x, y, w, h, 0, 0, outW, outH);

  return out;
}
