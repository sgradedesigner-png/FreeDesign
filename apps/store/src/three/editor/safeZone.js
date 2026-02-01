// src/three/editor/safeZone.js
// ✅ REACT руу шилжүүлсэн


import { SAFE_MARGINS_CM } from '../config/safeMargins.js';
import { clamp } from './clamp.js';

/**
 * Get safe area rectangle in relative coordinates (0-1)
 * @param {string} activeZoneKey - Zone key (front, back, etc)
 * @param {Object} printZoneCM - {width, height} in cm
 * @returns {Object} {uMin, uMax, vMin, vMax, marginsCm}
 */
export function getSafeRectRel(activeZoneKey, printZoneCM) {
  const m = SAFE_MARGINS_CM?.[activeZoneKey] || SAFE_MARGINS_CM.front;

  const W = Math.max(1e-6, printZoneCM?.width || 30);
  const H = Math.max(1e-6, printZoneCM?.height || 40);

  // placement v is TOP -> DOWN
  const uMin = m.left / W;
  const uMax = 1 - (m.right / W);
  const vMin = m.top / H;
  const vMax = 1 - (m.bottom / H);

  return { uMin, uMax, vMin, vMax, marginsCm: m };
}

/**
 * Get placement bounds
 * @param {Object} p - Placement {u, v, uScale, vScale}
 * @returns {Object} {left, right, top, bottom}
 */
export function placementBounds(p) {
  const left = p.u - p.uScale * 0.5;
  const right = p.u + p.uScale * 0.5;
  const top = p.v - p.vScale * 0.5;
  const bottom = p.v + p.vScale * 0.5;
  return { left, right, top, bottom };
}

/**
 * Check if placement is inside safe area
 * @param {Object} p - Placement object
 * @param {Object} safe - Safe area {uMin, uMax, vMin, vMax}
 * @returns {boolean} True if inside safe area
 */
export function isPlacementInsideSafe(p, safe) {
  const b = placementBounds(p);
  return (
    b.left >= safe.uMin &&
    b.right <= safe.uMax &&
    b.top >= safe.vMin &&
    b.bottom <= safe.vMax
  );
}

/**
 * Clamp placement to safe area
 * @param {Object} p - Placement object (will be modified)
 * @param {Object} safe - Safe area {uMin, uMax, vMin, vMax}
 * @returns {Object} Clamped placement
 */
export function clampPlacementToSafe(p, safe) {
  const halfW = p.uScale * 0.5;
  const halfH = p.vScale * 0.5;

  // Clamp center position to keep artwork inside safe area
  p.u = clamp(p.u, safe.uMin + halfW, safe.uMax - halfW);
  p.v = clamp(p.v, safe.vMin + halfH, safe.vMax - halfH);

  return p;
}

/**
 * Get distance from placement to safe area (if outside)
 * @param {Object} p - Placement object
 * @param {Object} safe - Safe area
 * @returns {number} Distance in UV units (0 if inside)
 */
export function getDistanceToSafe(p, safe) {
  if (isPlacementInsideSafe(p, safe)) return 0;

  const b = placementBounds(p);
  let dist = 0;

  if (b.left < safe.uMin) dist = Math.max(dist, safe.uMin - b.left);
  if (b.right > safe.uMax) dist = Math.max(dist, b.right - safe.uMax);
  if (b.top < safe.vMin) dist = Math.max(dist, safe.vMin - b.top);
  if (b.bottom > safe.vMax) dist = Math.max(dist, b.bottom - safe.vMax);

  return dist;
}