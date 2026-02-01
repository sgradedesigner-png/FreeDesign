// src/utils/safeZone.ts
// Safe zone utilities for placement validation

import { clamp } from './canvas';
import { SAFE_MARGINS_CM } from '@/config';
import type { ZoneKey, ZoneCM, SafeMargin, Placement } from '@/types';

export interface SafeRect {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
  marginsCm: SafeMargin;
}

export interface PlacementBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Get safe zone rectangle in relative coordinates (0-1)
 */
export function getSafeRectRel(
  zoneKey: ZoneKey,
  printZoneCM: ZoneCM | null
): SafeRect {
  const m = SAFE_MARGINS_CM[zoneKey] || SAFE_MARGINS_CM.front;

  const W = Math.max(1e-6, printZoneCM?.width || 30);
  const H = Math.max(1e-6, printZoneCM?.height || 40);

  // placement v is TOP -> DOWN
  const uMin = m.left / W;
  const uMax = 1 - m.right / W;
  const vMin = m.top / H;
  const vMax = 1 - m.bottom / H;

  return { uMin, uMax, vMin, vMax, marginsCm: m };
}

/**
 * Get placement bounding box
 */
export function getPlacementBounds(p: Placement): PlacementBounds {
  const left = p.u - p.uScale * 0.5;
  const right = p.u + p.uScale * 0.5;
  const top = p.v - p.vScale * 0.5;
  const bottom = p.v + p.vScale * 0.5;
  return { left, right, top, bottom };
}

/**
 * Check if placement is inside safe zone
 */
export function isPlacementInsideSafe(p: Placement, safe: SafeRect): boolean {
  const b = getPlacementBounds(p);
  return (
    b.left >= safe.uMin &&
    b.right <= safe.uMax &&
    b.top >= safe.vMin &&
    b.bottom <= safe.vMax
  );
}

/**
 * Clamp placement to stay inside safe zone
 */
export function clampPlacementToSafe(p: Placement, safe: SafeRect): Placement {
  const halfW = p.uScale * 0.5;
  const halfH = p.vScale * 0.5;

  return {
    ...p,
    u: clamp(p.u, safe.uMin + halfW, safe.uMax - halfW),
    v: clamp(p.v, safe.vMin + halfH, safe.vMax - halfH),
  };
}

/**
 * Clamp placement to stay inside zone bounds (0-1)
 */
export function clampPlacementToZone(p: Placement): Placement {
  const halfW = p.uScale * 0.5;
  const halfH = p.vScale * 0.5;
  const tolerance = 0.001;

  return {
    ...p,
    u: clamp(p.u, halfW - tolerance, 1 - halfW + tolerance),
    v: clamp(p.v, halfH - tolerance, 1 - halfH + tolerance),
  };
}

/**
 * Convert placement to CM dimensions
 */
export function placementToCm(
  p: Placement,
  printZoneCM: ZoneCM
): {
  width_cm: number;
  height_cm: number;
  x_cm: number;
  y_cm: number;
} {
  return {
    width_cm: p.uScale * printZoneCM.width,
    height_cm: p.vScale * printZoneCM.height,
    x_cm: p.u * printZoneCM.width,
    y_cm: (1 - p.v) * printZoneCM.height,
  };
}

/**
 * Convert CM width to placement scale
 */
export function cmToPlacementWidth(widthCm: number, printZoneCM: ZoneCM): number {
  return clamp(widthCm / printZoneCM.width, 0.05, 1.2);
}
