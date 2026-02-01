// src/types/decal.ts
import type * as THREE from 'three';

/** Decal pose for 3D placement */
export interface DecalPose {
  object: THREE.Mesh;
  position: THREE.Vector3;
  baseOrientation: THREE.Euler;
}

/** Raycast hit result */
export interface RaycastHit {
  point: THREE.Vector3;
  face: THREE.Face | null;
  object: THREE.Object3D;
  uv?: THREE.Vector2;
  distance: number;
}

/** Decal mesh configuration */
export interface DecalConfig {
  depth: number;
  polygonOffsetFactor: number;
  transparent: boolean;
  depthTest: boolean;
  depthWrite: boolean;
}
