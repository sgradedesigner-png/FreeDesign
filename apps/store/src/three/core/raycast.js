// src/three/core/raycast.js
// ✅ REACT руу шилжүүлсэн

import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/**
 * Perform raycast hit test
 * @param {MouseEvent|PointerEvent} event - Mouse/pointer event
 * @param {THREE.Camera} camera - Camera
 * @param {THREE.Object3D|Array} target - Target object(s) to test
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} opts - Options {recursive, layers}
 * @returns {Object|null} Hit result or null
 */
export function hitTest(event, camera, target, canvas, opts = {}) {
  if (!camera || !target || !canvas) return null;

  const { recursive = true } = opts;

  // Get mouse position in normalized device coordinates (-1 to +1)
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Update raycaster
  raycaster.setFromCamera(mouse, camera);

  // Apply layer filtering if specified
  if (opts.layers !== undefined) {
    raycaster.layers.set(opts.layers);
  }

  // Perform raycast
  const targets = Array.isArray(target) ? target : [target];
  const intersects = raycaster.intersectObjects(targets, recursive);

  if (intersects.length > 0) {
    const hit = intersects[0];
    return {
      object: hit.object,
      point: hit.point,
      face: hit.face,
      faceIndex: hit.faceIndex,
      distance: hit.distance,
      uv: hit.uv || null,
      instanceId: hit.instanceId
    };
  }

  return null;
}

/**
 * Get all raycast intersections
 * @param {MouseEvent|PointerEvent} event - Mouse/pointer event
 * @param {THREE.Camera} camera - Camera
 * @param {THREE.Object3D|Array} target - Target object(s)
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} opts - Options {recursive, maxResults}
 * @returns {Array} Array of hit results
 */
export function hitTestAll(event, camera, target, canvas, opts = {}) {
  if (!camera || !target || !canvas) return [];

  const { recursive = true, maxResults = Infinity } = opts;

  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const targets = Array.isArray(target) ? target : [target];
  const intersects = raycaster.intersectObjects(targets, recursive);

  return intersects.slice(0, maxResults).map(hit => ({
    object: hit.object,
    point: hit.point,
    face: hit.face,
    faceIndex: hit.faceIndex,
    distance: hit.distance,
    uv: hit.uv || null,
    instanceId: hit.instanceId
  }));
}

/**
 * Raycast from arbitrary origin and direction
 * @param {THREE.Vector3} origin - Ray origin
 * @param {THREE.Vector3} direction - Ray direction (normalized)
 * @param {THREE.Object3D|Array} target - Target object(s)
 * @param {Object} opts - Options {recursive, near, far}
 * @returns {Object|null} Hit result or null
 */
export function raycastFromOrigin(origin, direction, target, opts = {}) {
  const { recursive = true, near = 0, far = Infinity } = opts;

  raycaster.set(origin, direction);
  raycaster.near = near;
  raycaster.far = far;

  const targets = Array.isArray(target) ? target : [target];
  const intersects = raycaster.intersectObjects(targets, recursive);

  if (intersects.length > 0) {
    const hit = intersects[0];
    return {
      object: hit.object,
      point: hit.point,
      face: hit.face,
      distance: hit.distance,
      uv: hit.uv || null
    };
  }

  return null;
}

/**
 * Get mouse position in normalized device coordinates
 * @param {MouseEvent|PointerEvent} event - Mouse/pointer event
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @returns {THREE.Vector2} Normalized mouse position
 */
export function getMouseNDC(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  return new THREE.Vector2(x, y);
}

/**
 * Get ray from camera through screen point
 * @param {MouseEvent|PointerEvent} event - Mouse/pointer event
 * @param {THREE.Camera} camera - Camera
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @returns {THREE.Ray} Ray
 */
export function getRay(event, camera, canvas) {
  const ndc = getMouseNDC(event, canvas);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.clone();
}

/**
 * Check if point is visible from camera
 * @param {THREE.Vector3} point - World point
 * @param {THREE.Camera} camera - Camera
 * @param {THREE.Object3D|Array} occluders - Objects that can occlude
 * @returns {boolean} True if visible
 */
export function isPointVisible(point, camera, occluders) {
  const direction = new THREE.Vector3().subVectors(point, camera.position).normalize();
  const distance = camera.position.distanceTo(point);

  raycaster.set(camera.position, direction);
  raycaster.near = 0;
  raycaster.far = distance - 0.01; // Slight offset

  const targets = Array.isArray(occluders) ? occluders : [occluders];
  const intersects = raycaster.intersectObjects(targets, true);

  return intersects.length === 0;
}

/**
 * Set raycaster precision
 * @param {Object} params - {threshold, near, far}
 */
export function setRaycasterParams(params = {}) {
  if (params.threshold !== undefined) {
    raycaster.params.Line.threshold = params.threshold;
    raycaster.params.Points.threshold = params.threshold;
  }
  if (params.near !== undefined) raycaster.near = params.near;
  if (params.far !== undefined) raycaster.far = params.far;
}

/**
 * Get global raycaster instance (for advanced usage)
 * @returns {THREE.Raycaster} Raycaster
 */
export function getRaycaster() {
  return raycaster;
}