// src/three/decal/decalBuilder.ts
import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { orientationWithUserRotation, type DecalPose } from './decalPose';

/** Decal size configuration */
export interface DecalSize {
  width: number;
  height: number;
  depth: number;
}

/**
 * Build a decal mesh from pose and size
 */
export function buildDecalMesh(
  pose: DecalPose,
  size: DecalSize,
  rotationRad: number,
  material: THREE.Material
): THREE.Mesh {
  const orientation = orientationWithUserRotation(pose.baseOrientation, rotationRad);
  const sizeVec = new THREE.Vector3(size.width, size.height, size.depth);
  const geometry = new DecalGeometry(pose.object, pose.position, orientation, sizeVec);
  return new THREE.Mesh(geometry, material);
}

/**
 * Dispose decal mesh and remove from scene
 */
export function disposeDecalMesh(
  mesh: THREE.Mesh | null,
  scene?: THREE.Scene
): void {
  if (!mesh) return;
  mesh.geometry?.dispose();
  scene?.remove(mesh);
}

/**
 * Update decal mesh with new parameters
 */
export function updateDecalMesh(
  oldMesh: THREE.Mesh | null,
  scene: THREE.Scene,
  pose: DecalPose,
  size: DecalSize,
  rotationRad: number,
  material: THREE.Material
): THREE.Mesh {
  disposeDecalMesh(oldMesh, scene);
  const newMesh = buildDecalMesh(pose, size, rotationRad, material);
  scene.add(newMesh);
  return newMesh;
}
