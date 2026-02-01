// src/config/placementPresets.ts
import type { ZoneKey } from '@/types';

/**
 * Preset placement configuration
 * All measurements are in centimeters, converted to UV coordinates at runtime
 */
export interface PlacementPreset {
  id: string;
  name: string;
  nameKey: string; // i18n key
  /** Width in cm */
  widthCm: number;
  /** Height in cm */
  heightCm: number;
  /** Distance from top (collar) in cm */
  fromTopCm: number;
  /** Horizontal position: 'left' | 'center' | 'right' */
  horizontalAlign: 'left' | 'center' | 'right';
  /** For left alignment, distance from left edge in cm */
  fromLeftCm?: number;
}

/**
 * Convert preset to UV placement
 * @param preset - The preset configuration
 * @param zoneCm - Zone dimensions in cm { width, height }
 * @param imageAspect - Image aspect ratio (width/height)
 */
export function presetToPlacement(
  preset: PlacementPreset,
  zoneCm: { width: number; height: number },
  imageAspect: number = 1
): { u: number; v: number; uScale: number; vScale: number } {
  // Calculate preset's bounding box in UV space
  const presetUWidth = preset.widthCm / zoneCm.width;
  const presetVHeight = preset.heightCm / zoneCm.height;

  // Calculate scale while preserving image aspect ratio
  // Fit image within preset bounds
  const presetAspect = preset.widthCm / preset.heightCm;
  let uScale: number;
  let vScale: number;

  if (imageAspect >= presetAspect) {
    // Image is wider than preset - fit by width
    uScale = presetUWidth;
    vScale = presetUWidth / imageAspect;
  } else {
    // Image is taller than preset - fit by height
    vScale = presetVHeight;
    uScale = presetVHeight * imageAspect;
  }

  // Calculate horizontal position (u)
  let u: number;
  if (preset.horizontalAlign === 'center') {
    u = 0.5;
  } else if (preset.horizontalAlign === 'left') {
    // Left edge + half of actual image width
    const leftEdgeCm = preset.fromLeftCm ?? 2;
    const actualWidthCm = uScale * zoneCm.width;
    u = (leftEdgeCm + actualWidthCm / 2) / zoneCm.width;
  } else {
    // Right aligned
    const rightEdgeCm = preset.fromLeftCm ?? 2;
    const actualWidthCm = uScale * zoneCm.width;
    u = 1 - (rightEdgeCm + actualWidthCm / 2) / zoneCm.width;
  }

  // Calculate vertical position (v)
  // In this system: v=0 is TOP, v=1 is BOTTOM
  // fromTopCm is distance from top edge to top of image
  const actualHeightCm = vScale * zoneCm.height;
  const centerFromTopCm = preset.fromTopCm + actualHeightCm / 2;
  const v = centerFromTopCm / zoneCm.height;

  return {
    u: Math.max(0, Math.min(1, u)),
    v: Math.max(0, Math.min(1, v)),
    uScale: Math.max(0.05, Math.min(1.2, uScale)),
    vScale: Math.max(0.05, Math.min(1.2, vScale)),
  };
}

/**
 * Front zone presets
 * Zone size: 30cm x 40cm
 * fromTopCm: distance from collar (top edge) to top of image
 *
 * Percentage-based calculations:
 * - Left Chest:   W: 20%, H: 20%, Top: 20%, Left: 13%
 * - Center Chest: W: 43%, H: 30%, Top: 23%, Center
 * - Full Front:   W: 57%, H: 68%, Top: 13%, Center
 * - Oversize:     W: 67%, H: 78%, Top: 9%,  Center
 */
export const FRONT_PRESETS: PlacementPreset[] = [
  {
    id: 'left_chest',
    name: 'Left Chest',
    nameKey: 'presets.leftChest',
    widthCm: 6,      // 20% of 30cm
    heightCm: 8,     // 20% of 40cm
    fromTopCm: 8,    // 20% from top
    horizontalAlign: 'right',  // UV is mirrored: right on UV = left chest on 3D
    fromLeftCm: 4,   // 13% from right edge (distance from edge)
  },
  {
    id: 'center_chest',
    name: 'Center Chest',
    nameKey: 'presets.centerChest',
    widthCm: 13,     // 43% of 30cm
    heightCm: 12,    // 30% of 40cm
    fromTopCm: 9,    // 23% from top
    horizontalAlign: 'center',
  },
  {
    id: 'full_front',
    name: 'Full Front',
    nameKey: 'presets.fullFront',
    widthCm: 17,     // 57% of 30cm
    heightCm: 27,    // 68% of 40cm
    fromTopCm: 5,    // 13% from top
    horizontalAlign: 'center',
  },
  {
    id: 'oversize_front',
    name: 'Oversize',
    nameKey: 'presets.oversizeFront',
    widthCm: 20,     // 67% of 30cm
    heightCm: 31,    // 78% of 40cm
    fromTopCm: 3.5,  // 9% from top
    horizontalAlign: 'center',
  },
];

/**
 * Back zone presets
 * Zone size: 30cm x 40cm
 *
 * Based on DTF Station standard placements:
 * - Back Collar: 1" from top, small rectangle
 * - Upper Back:  4" from top, wide horizontal bar
 * - Full Back:   4" from top, large square
 */
export const BACK_PRESETS: PlacementPreset[] = [
  {
    id: 'back_collar',
    name: 'Back Collar',
    nameKey: 'presets.backCollar',
    widthCm: 5,      // ~17% of 30cm
    heightCm: 5,     // ~12% of 40cm
    fromTopCm: 2.5,  // 1 inch from collar
    horizontalAlign: 'center',
  },
  {
    id: 'upper_back',
    name: 'Upper Back',
    nameKey: 'presets.upperBack',
    widthCm: 26,     // ~87% of 30cm (almost full width)
    heightCm: 6,     // ~15% of 40cm (narrow horizontal bar)
    fromTopCm: 4,    // Higher position (zone top already below collar)
    horizontalAlign: 'center',
  },
  {
    id: 'full_back',
    name: 'Full Back',
    nameKey: 'presets.fullBack',
    widthCm: 23,     // ~77% of 30cm
    heightCm: 27,    // ~68% of 40cm
    fromTopCm: 4,    // Higher position (zone top already below collar)
    horizontalAlign: 'center',
  },
];

/**
 * Left arm presets
 * Zone size: 10cm x 12cm
 * Presets should scale proportionally:
 *   Small:  ~25% of zone = 2.5cm
 *   Medium: ~40% of zone = 4cm
 *   Large:  ~60% of zone = 6cm
 */
export const LEFT_ARM_PRESETS: PlacementPreset[] = [
  {
    id: 'sleeve_small',
    name: 'Small',
    nameKey: 'presets.sleeveSmall',
    widthCm: 2.5,
    heightCm: 2.5,
    fromTopCm: 4,
    horizontalAlign: 'center',
  },
  {
    id: 'sleeve_medium',
    name: 'Medium',
    nameKey: 'presets.sleeveMedium',
    widthCm: 4,
    heightCm: 4,
    fromTopCm: 3,
    horizontalAlign: 'center',
  },
  {
    id: 'sleeve_large',
    name: 'Large',
    nameKey: 'presets.sleeveLarge',
    widthCm: 6,
    heightCm: 7,
    fromTopCm: 2,
    horizontalAlign: 'center',
  },
];

/**
 * Right arm presets (same as left)
 */
export const RIGHT_ARM_PRESETS: PlacementPreset[] = LEFT_ARM_PRESETS.map(preset => ({
  ...preset,
  id: preset.id.replace('sleeve', 'right_sleeve'),
}));

/**
 * Get presets for a specific zone
 */
export function getPresetsForZone(zoneKey: ZoneKey): PlacementPreset[] {
  switch (zoneKey) {
    case 'front':
      return FRONT_PRESETS;
    case 'back':
      return BACK_PRESETS;
    case 'left_arm':
      return LEFT_ARM_PRESETS;
    case 'right_arm':
      return RIGHT_ARM_PRESETS;
    default:
      return [];
  }
}
