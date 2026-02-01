// src/config/zoneMeshNames.ts
import type { ZoneKey } from '@/types';

/**
 * Mapping of zone keys to mesh names in the GLTF model
 */
export const ZONE_MESH_NAMES: Record<ZoneKey, string> = {
  front: 'PRINT_ZONE_FRONT',
  back: 'PRINT_ZONE_BACK',
  left_arm: 'PRINT_ZONE_LEFT_ARM',
  right_arm: 'PRINT_ZONE_RIGHT_ARM',
};

/**
 * Camera positions for each zone view
 */
export interface CameraPosition {
  x: number;
  y: number;
  z: number;
  distMultiplier: number;
}

export const ZONE_CAMERA_POSITIONS: Record<ZoneKey | 'all', CameraPosition> = {
  front: { x: 0, y: 0, z: 1, distMultiplier: 3.5 },
  back: { x: 0, y: 0, z: -1, distMultiplier: 3.5 },
  left_arm: { x: 1, y: 0, z: 0, distMultiplier: 3.0 },
  right_arm: { x: -1, y: 0, z: 0, distMultiplier: 3.0 },
  all: { x: 0, y: 0, z: 1, distMultiplier: 4.0 },
};
