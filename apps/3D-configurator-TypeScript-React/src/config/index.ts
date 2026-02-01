// src/config/index.ts
// Re-export all config

export {
  DEFAULT_DPI,
  DEFAULT_TEMPLATE_PX,
  DECAL_DEPTH,
  WORLD_ZONE_W,
  MIN_SCALE,
  MAX_SCALE,
  DEFAULT_SCALE,
  CENTER_SNAP_THRESHOLD,
  DEFAULT_GRID_CM,
} from './constants';

export {
  ZONE_CM,
  getZoneCM,
  getProductZones,
} from './printZones';

export {
  SAFE_MARGINS_CM,
  getSafeMargin,
  getSafeAreaNormalized,
} from './safeMargins';

export {
  ZONE_MESH_NAMES,
  ZONE_CAMERA_POSITIONS,
  type CameraPosition,
} from './zoneMeshNames';

export {
  FRONT_PRESETS,
  BACK_PRESETS,
  LEFT_ARM_PRESETS,
  RIGHT_ARM_PRESETS,
  getPresetsForZone,
  presetToPlacement,
  type PlacementPreset,
} from './placementPresets';
