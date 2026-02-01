// src/three/core/scene.js
// ✅ REACT руу шилжүүлсэн

import * as THREE from 'three';

let sceneContext = null;

/**
 * Initialize Three.js scene
 * @param {Object} opts - Options {background, lightProfile, aspect}
 * @returns {Object} {scene, camera}
 */
export function initScene(opts = {}) {
  const {
    background = new THREE.Color(0xf5f5f5),
    lightProfile = 'studio',
    aspect = 1.5
  } = opts;

  // Create scene
  const scene = new THREE.Scene();
  scene.background = background;

  // Create camera
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
  camera.position.set(0, 0, 3);

  // Add lights based on profile
  addLights(scene, lightProfile);

  // Store context
  sceneContext = { scene, camera };

  return { scene, camera };
}

/**
 * Get current scene context
 * @returns {Object|null} {scene, camera} or null
 */
export function getContext() {
  return sceneContext;
}

/**
 * Add lights to scene
 * @param {THREE.Scene} scene - Scene
 * @param {string} profile - Light profile ('studio', 'outdoor', 'minimal')
 */
function addLights(scene, profile) {
  switch (profile) {
    case 'studio':
      addStudioLights(scene);
      break;
    case 'outdoor':
      addOutdoorLights(scene);
      break;
    case 'minimal':
      addMinimalLights(scene);
      break;
    default:
      addStudioLights(scene);
  }
}

/**
 * Add studio lighting setup
 * @param {THREE.Scene} scene - Scene
 */
function addStudioLights(scene) {
  // Ambient light
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  // Key light (main directional)
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
  keyLight.position.set(5, 5, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  scene.add(keyLight);

  // Fill light (softer, opposite side)
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-3, 3, -3);
  scene.add(fillLight);

  // Back light (rim light)
  const backLight = new THREE.DirectionalLight(0xffffff, 0.2);
  backLight.position.set(0, 3, -5);
  scene.add(backLight);
}

/**
 * Add outdoor lighting setup
 * @param {THREE.Scene} scene - Scene
 */
function addOutdoorLights(scene) {
  // Ambient light (sky color)
  const ambient = new THREE.AmbientLight(0x87ceeb, 0.5);
  scene.add(ambient);

  // Sun light
  const sun = new THREE.DirectionalLight(0xfff5e1, 1.0);
  sun.position.set(10, 10, 5);
  sun.castShadow = true;
  scene.add(sun);

  // Hemisphere light (sky + ground)
  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.4);
  scene.add(hemi);
}

/**
 * Add minimal lighting setup
 * @param {THREE.Scene} scene - Scene
 */
function addMinimalLights(scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 0.5);
  directional.position.set(3, 5, 4);
  scene.add(directional);
}

/**
 * Update scene background
 * @param {THREE.Scene} scene - Scene
 * @param {THREE.Color|null} color - Background color or null for transparent
 */
export function setSceneBackground(scene, color) {
  scene.background = color;
}

/**
 * Clear scene (remove all objects)
 * @param {THREE.Scene} scene - Scene
 */
export function clearScene(scene) {
  while (scene.children.length > 0) {
    const child = scene.children[0];
    scene.remove(child);
    
    // Dispose geometry and material
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  }
}

/**
 * Dispose scene and cleanup
 */
export function disposeScene() {
  if (sceneContext?.scene) {
    clearScene(sceneContext.scene);
  }
  sceneContext = null;
}