// src/three/decal/decalBuilder.js
// ✅ REACT руу шилжүүлсэн

import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { orientationWithUserRotation } from './decalPose.js';

/**
 * Build decal mesh from pose and dimensions
 * @param {Object} pose - Pose with object, position, baseOrientation
 * @param {Object} dimensions - {width, height, depth}
 * @param {number} rotationRad - User rotation in radians
 * @param {THREE.Material} material - Decal material
 * @returns {THREE.Mesh} Decal mesh
 */
export function buildDecalMesh(pose, { width, height, depth }, rotationRad, material) {
  if (!pose || !pose.object || !pose.position || !pose.baseOrientation) {
    console.error('Invalid pose for decal build');
    return null;
  }

  // Apply user rotation to base orientation
  const orientation = orientationWithUserRotation(pose.baseOrientation, rotationRad);
  
  // Create size vector
  const size = new THREE.Vector3(width, height, depth);
  
  // Create decal geometry
  const geo = new DecalGeometry(pose.object, pose.position, orientation, size);
  
  // Create mesh
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'DecalMesh';
  
  return mesh;
}

/**
 * Dispose decal mesh and remove from scene
 * @param {THREE.Mesh} mesh - Decal mesh to dispose
 * @param {THREE.Scene} scene - Scene to remove from
 */
export function disposeDecalMesh(mesh, scene) {
  if (!mesh) return;
  
  // Dispose geometry
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }
  
  // Remove from scene
  if (scene) {
    scene.remove(mesh);
  }
}

/**
 * Update decal mesh position and orientation
 * @param {THREE.Mesh} mesh - Existing decal mesh
 * @param {Object} pose - New pose
 * @param {number} rotationRad - New rotation
 * @returns {THREE.Mesh} Updated mesh (or new if needed)
 */
export function updateDecalMesh(mesh, pose, rotationRad) {
  if (!mesh || !pose) return null;
  
  // For decals, it's often easier to rebuild than update
  // because DecalGeometry is complex
  // This is a placeholder - in practice you'd rebuild
  return mesh;
}