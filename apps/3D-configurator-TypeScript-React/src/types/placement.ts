// src/types/placement.ts

/** Artwork placement in normalized UV coordinates */
export interface Placement {
  /** Horizontal center position (0-1) */
  u: number;
  /** Vertical center position (0-1) */
  v: number;
  /** Horizontal scale (0.05-1.2) */
  uScale: number;
  /** Vertical scale (0.05-1.2) */
  vScale: number;
  /** Rotation in radians */
  rotationRad: number;
}

/** Placement in centimeters (for export) */
export interface PlacementCM {
  width_cm: number;
  height_cm: number;
  x_cm: number;
  y_cm: number;
}

/** Zone draft state */
export interface ZoneDraft {
  image: HTMLImageElement | null;
  placement: Placement | null;
  locked: boolean;
}

/** Snap settings for placement */
export interface SnapSettings {
  enableCenterSnap: boolean;
  enableGridSnap: boolean;
  gridCm: number;
}

/** Snap function options */
export interface SnapOptions extends SnapSettings {
  printZoneCM: { width: number; height: number };
  shiftToDisable?: boolean;
  shiftKey?: boolean;
}
