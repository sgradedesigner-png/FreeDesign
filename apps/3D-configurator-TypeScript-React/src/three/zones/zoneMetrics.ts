// src/three/zones/zoneMetrics.ts
import type { ZoneRect, ZoneCM } from '../../types/zone';

/** Position in centimeters */
export interface PositionCM {
  x_cm: number;
  y_cm: number;
}

/**
 * Convert UV coordinates to print zone centimeters
 */
export function uvToPrintCM(
  hitUV: { x: number; y: number },
  printZone: ZoneRect,
  printZoneCM: ZoneCM
): PositionCM {
  const uRel =
    (hitUV.x - printZone.uMin) /
    Math.max(1e-6, printZone.uMax - printZone.uMin);
  const vRel =
    (hitUV.y - printZone.vMin) /
    Math.max(1e-6, printZone.vMax - printZone.vMin);

  return {
    x_cm: uRel * printZoneCM.width,
    y_cm: (1 - vRel) * printZoneCM.height,
  };
}

/**
 * Convert centimeters to UV coordinates
 */
export function cmToUV(
  position: PositionCM,
  printZone: ZoneRect,
  printZoneCM: ZoneCM
): { u: number; v: number } {
  const uRel = position.x_cm / printZoneCM.width;
  const vRel = 1 - position.y_cm / printZoneCM.height;

  return {
    u: printZone.uMin + uRel * (printZone.uMax - printZone.uMin),
    v: printZone.vMin + vRel * (printZone.vMax - printZone.vMin),
  };
}

/**
 * Get zone dimensions in UV space
 */
export function getZoneUVDimensions(zone: ZoneRect): {
  width: number;
  height: number;
} {
  return {
    width: zone.uMax - zone.uMin,
    height: zone.vMax - zone.vMin,
  };
}

/**
 * Calculate aspect ratio of zone in UV space
 */
export function getZoneAspectRatio(zone: ZoneRect): number {
  const dims = getZoneUVDimensions(zone);
  return dims.width / Math.max(1e-6, dims.height);
}
