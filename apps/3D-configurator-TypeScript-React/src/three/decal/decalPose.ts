// src/three/decal/decalPose.ts
import * as THREE from 'three';

/** Decal pose for 3D placement */
export interface DecalPose {
  object: THREE.Mesh;
  position: THREE.Vector3;
  baseOrientation: THREE.Euler;
}

/**
 * Build decal pose from raycast hit
 */
export function buildPoseFromHit(hit: THREE.Intersection): DecalPose | null {
  const position = hit.point.clone();
  const n = hit.face?.normal?.clone();

  if (!n) return null;

  n.transformDirection(hit.object.matrixWorld);

  const m = new THREE.Matrix4();
  m.lookAt(position, position.clone().add(n), new THREE.Vector3(0, 1, 0));
  const baseOrientation = new THREE.Euler().setFromRotationMatrix(m);

  return {
    object: hit.object as THREE.Mesh,
    position,
    baseOrientation,
  };
}

/**
 * Apply user rotation to base orientation
 */
export function orientationWithUserRotation(
  baseOrientation: THREE.Euler,
  rotationRad = 0
): THREE.Euler {
  const o = baseOrientation.clone();
  o.z += rotationRad;
  return o;
}
