// src/three/decal/decalPose.js
// ✅ REACT руу шилжүүлсэн - Өөрчлөлтгүй

import * as THREE from 'three';

/**
 * Build base pose (position + orientation) from raycast hit normal
 * @param {Object} hit - Raycast hit result
 * @returns {Object|null} Pose object with position and baseOrientation
 */
export function buildPoseFromHit(hit) {
  if (!hit || !hit.point || !hit.face?.normal) return null;

  const position = hit.point.clone();
  const n = hit.face.normal.clone();
  
  // Transform normal to world space
  n.transformDirection(hit.object.matrixWorld);

  // Create orientation matrix looking at the normal
  const m = new THREE.Matrix4();
  m.lookAt(position, position.clone().add(n), new THREE.Vector3(0, 1, 0));
  const baseOrientation = new THREE.Euler().setFromRotationMatrix(m);

  return { 
    object: hit.object, 
    position, 
    baseOrientation 
  };
}

/**
 * Apply user rotation to base orientation
 * @param {THREE.Euler} baseOrientation - Base orientation from hit
 * @param {number} rotationRad - User rotation in radians
 * @returns {THREE.Euler} Combined orientation
 */
export function orientationWithUserRotation(baseOrientation, rotationRad = 0) {
  const o = baseOrientation.clone();
  o.z += rotationRad;
  return o;
}