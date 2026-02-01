// src/config/safeMargins.ts
import type { ZoneSafeMargins, ZoneKey, SafeMargin } from '../types/zone';

/** Safe margins in centimeters (inside the print zone) */
export const SAFE_MARGINS_CM: ZoneSafeMargins = {
  front:     { top: 3.0, bottom: 2.0, left: 2.0, right: 2.0 },
  back:      { top: 3.5, bottom: 2.0, left: 2.0, right: 2.0 },
  left_arm:  { top: 1.0, bottom: 1.0, left: 1.0, right: 1.0 },
  right_arm: { top: 1.0, bottom: 1.0, left: 1.0, right: 1.0 },
};

/** Get safe margin for a specific zone */
export function getSafeMargin(zone: ZoneKey): SafeMargin {
  return SAFE_MARGINS_CM[zone];
}

/** Calculate safe area in normalized coordinates (0-1) */
export function getSafeAreaNormalized(
  zone: ZoneKey,
  zoneCM: { width: number; height: number }
): { left: number; right: number; top: number; bottom: number } {
  const margin = SAFE_MARGINS_CM[zone];
  return {
    left: margin.left / zoneCM.width,
    right: 1 - margin.right / zoneCM.width,
    top: margin.top / zoneCM.height,
    bottom: 1 - margin.bottom / zoneCM.height,
  };
}
