// src/utils/canvas.ts
// Canvas utility functions

/**
 * Clamp a value between min and max
 */
export function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/**
 * Get device pixel ratio (capped at 2 for performance)
 */
export function getDPR(): number {
  return Math.min(2, window.devicePixelRatio || 1);
}

/**
 * Resize canvas for high DPI displays
 */
export function resizeCanvasForDPR(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): void {
  const dpr = getDPR();
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
}

/**
 * Get mouse/touch position relative to canvas in canvas coordinates
 */
export function getCanvasCoords(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (canvas.width / rect.width);
  const y = (clientY - rect.top) * (canvas.height / rect.height);
  return { x, y };
}

/**
 * Get distance between two touch points
 */
export function getTouchDistance(
  touch1: { clientX: number; clientY: number },
  touch2: { clientX: number; clientY: number }
): number {
  return Math.hypot(
    touch1.clientX - touch2.clientX,
    touch1.clientY - touch2.clientY
  );
}

/**
 * Convert UV coordinates to world pixel position
 */
export function uvToWorldPx(
  u: number,
  v: number,
  tplX: number,
  tplY: number,
  tplW: number,
  tplH: number
): { x: number; y: number } {
  const x = tplX + u * tplW;
  const y = tplY + (1 - v) * tplH;
  return { x, y };
}

/**
 * Convert world pixel position to UV coordinates
 */
export function worldPxToUV(
  x: number,
  y: number,
  tplX: number,
  tplY: number,
  tplW: number,
  tplH: number
): { u: number; v: number } {
  const u0 = (x - tplX) / Math.max(1e-6, tplW);
  const v0 = 1 - (y - tplY) / Math.max(1e-6, tplH);
  return { u: clamp(u0, 0, 1), v: clamp(v0, 0, 1) };
}

/**
 * Apply view transform to world coordinates
 */
export function worldToCanvas(
  x: number,
  y: number,
  viewScale: number,
  viewOffsetX: number,
  viewOffsetY: number
): { x: number; y: number } {
  return {
    x: x * viewScale + viewOffsetX,
    y: y * viewScale + viewOffsetY,
  };
}

/**
 * Apply inverse view transform to canvas coordinates
 */
export function canvasToWorld(
  x: number,
  y: number,
  viewScale: number,
  viewOffsetX: number,
  viewOffsetY: number
): { x: number; y: number } {
  return {
    x: (x - viewOffsetX) / Math.max(1e-6, viewScale),
    y: (y - viewOffsetY) / Math.max(1e-6, viewScale),
  };
}
