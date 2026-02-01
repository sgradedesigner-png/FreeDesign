// src/three/core/controls.js
// ✅ REACT руу шилжүүлсэн

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let currentMode = 'EDIT'; // EDIT, LOCKED, VIEW

/**
 * Create orbit controls
 * @param {THREE.Camera} camera - Camera
 * @param {HTMLCanvasElement} domElement - Canvas element
 * @returns {OrbitControls} Controls instance
 */
export function createControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  
  // Default settings
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 1;
  controls.maxDistance = 5;
  controls.maxPolarAngle = Math.PI / 1.5;
  
  return controls;
}

/**
 * Update controls (call in animation loop)
 * @param {OrbitControls} controls - Controls instance
 */
export function updateControls(controls) {
  if (controls && controls.enabled) {
    controls.update();
  }
}

/**
 * Set control mode
 * @param {string} mode - Mode: 'EDIT', 'LOCKED', 'VIEW'
 * @param {OrbitControls} controls - Controls instance (optional)
 */
export function setControlMode(mode, controls = null) {
  currentMode = mode;
  
  if (!controls) return;

  switch (mode) {
    case 'EDIT':
      controls.enabled = true;
      controls.enableRotate = true;
      controls.enableZoom = true;
      controls.enablePan = true;
      break;
      
    case 'LOCKED':
      controls.enabled = false;
      break;
      
    case 'VIEW':
      controls.enabled = true;
      controls.enableRotate = true;
      controls.enableZoom = true;
      controls.enablePan = false;
      break;
      
    default:
      controls.enabled = true;
  }
}

/**
 * Get current control mode
 * @returns {string} Current mode
 */
export function getControlMode() {
  return currentMode;
}

/**
 * Reset controls to default position
 * @param {OrbitControls} controls - Controls instance
 * @param {THREE.Vector3} target - Target position (default: origin)
 */
export function resetControls(controls, target = null) {
  if (!controls) return;
  
  if (target) {
    controls.target.copy(target);
  } else {
    controls.target.set(0, 0, 0);
  }
  
  controls.update();
}

/**
 * Animate camera to position
 * @param {OrbitControls} controls - Controls instance
 * @param {THREE.Camera} camera - Camera
 * @param {THREE.Vector3} targetPos - Target camera position
 * @param {THREE.Vector3} targetLookAt - Target look-at position
 * @param {number} duration - Animation duration in ms
 */
export function animateCameraTo(controls, camera, targetPos, targetLookAt, duration = 1000) {
  if (!controls || !camera) return Promise.resolve();

  return new Promise((resolve) => {
    const startPos = camera.position.clone();
    const startLookAt = controls.target.clone();
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      
      // Ease in-out
      const eased = t < 0.5
        ? 2 * t * t
        : -1 + (4 - 2 * t) * t;

      // Interpolate position
      camera.position.lerpVectors(startPos, targetPos, eased);
      controls.target.lerpVectors(startLookAt, targetLookAt, eased);
      controls.update();

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    };

    animate();
  });
}

/**
 * Set camera limits
 * @param {OrbitControls} controls - Controls instance
 * @param {Object} limits - {minDistance, maxDistance, minPolarAngle, maxPolarAngle}
 */
export function setCameraLimits(controls, limits = {}) {
  if (!controls) return;

  if (limits.minDistance !== undefined) controls.minDistance = limits.minDistance;
  if (limits.maxDistance !== undefined) controls.maxDistance = limits.maxDistance;
  if (limits.minPolarAngle !== undefined) controls.minPolarAngle = limits.minPolarAngle;
  if (limits.maxPolarAngle !== undefined) controls.maxPolarAngle = limits.maxPolarAngle;
  if (limits.minAzimuthAngle !== undefined) controls.minAzimuthAngle = limits.minAzimuthAngle;
  if (limits.maxAzimuthAngle !== undefined) controls.maxAzimuthAngle = limits.maxAzimuthAngle;
}

/**
 * Enable/disable auto-rotate
 * @param {OrbitControls} controls - Controls instance
 * @param {boolean} enabled - Enable auto-rotate
 * @param {number} speed - Rotation speed (default: 2.0)
 */
export function setAutoRotate(controls, enabled, speed = 2.0) {
  if (!controls) return;
  
  controls.autoRotate = enabled;
  controls.autoRotateSpeed = speed;
}

/**
 * Dispose controls
 * @param {OrbitControls} controls - Controls instance
 */
export function disposeControls(controls) {
  if (controls) {
    controls.dispose();
  }
}