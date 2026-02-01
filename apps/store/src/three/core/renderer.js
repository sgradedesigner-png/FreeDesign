// src/three/core/renderer.js
// ✅ REACT руу шилжүүлсэн

import * as THREE from 'three';

/**
 * Create WebGL renderer
 * @param {HTMLElement} container - Container element
 * @param {Object} opts - Options {alpha, antialias, preserveDrawingBuffer}
 * @returns {Object} {renderer, canvas}
 */
export function createRenderer(container, opts = {}) {
  const {
    alpha = true,
    antialias = true,
    preserveDrawingBuffer = false
  } = opts;

  // Create canvas
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  // Create renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha,
    antialias,
    preserveDrawingBuffer
  });

  // Set size
  const width = container.clientWidth;
  const height = container.clientHeight;
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

  // Set color space
  if ('outputColorSpace' in renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } else {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }

  // Enable shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  return { renderer, canvas };
}

/**
 * Resize renderer to match element size
 * @param {THREE.WebGLRenderer} renderer - Renderer
 * @param {HTMLElement} element - Container element
 */
export function resizeRendererToElement(renderer, element) {
  if (!renderer || !element) return;

  const rect = element.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  if (width < 10 || height < 10) return;

  const canvas = renderer.domElement;
  const needResize = canvas.width !== width || canvas.height !== height;

  if (needResize) {
    renderer.setSize(width, height, false);
  }

  return needResize;
}

/**
 * Set renderer pixel ratio
 * @param {THREE.WebGLRenderer} renderer - Renderer
 * @param {number} ratio - Pixel ratio (default: devicePixelRatio)
 */
export function setPixelRatio(renderer, ratio = null) {
  const pr = ratio || window.devicePixelRatio || 1;
  renderer.setPixelRatio(Math.min(2, pr)); // Cap at 2x for performance
}

/**
 * Render scene
 * @param {THREE.WebGLRenderer} renderer - Renderer
 * @param {THREE.Scene} scene - Scene
 * @param {THREE.Camera} camera - Camera
 */
export function render(renderer, scene, camera) {
  renderer.render(scene, camera);
}

/**
 * Capture renderer output as data URL
 * @param {THREE.WebGLRenderer} renderer - Renderer
 * @param {string} format - Image format ('image/png', 'image/jpeg')
 * @param {number} quality - JPEG quality (0-1)
 * @returns {string} Data URL
 */
export function captureImage(renderer, format = 'image/png', quality = 1.0) {
  return renderer.domElement.toDataURL(format, quality);
}

/**
 * Capture renderer output as Blob
 * @param {THREE.WebGLRenderer} renderer - Renderer
 * @param {string} format - Image format
 * @returns {Promise<Blob>} Blob promise
 */
export function captureBlob(renderer, format = 'image/png') {
  return new Promise((resolve, reject) => {
    renderer.domElement.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to capture blob'));
      },
      format
    );
  });
}

/**
 * Set renderer clear color
 * @param {THREE.WebGLRenderer} renderer - Renderer
 * @param {number|string} color - Color (hex or CSS)
 * @param {number} alpha - Alpha (0-1)
 */
export function setClearColor(renderer, color, alpha = 1) {
  renderer.setClearColor(color, alpha);
}

/**
 * Dispose renderer
 * @param {THREE.WebGLRenderer} renderer - Renderer
 */
export function disposeRenderer(renderer) {
  if (!renderer) return;
  
  renderer.dispose();
  
  // Remove canvas
  if (renderer.domElement && renderer.domElement.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
}

/**
 * Get renderer info (for debugging)
 * @param {THREE.WebGLRenderer} renderer - Renderer
 * @returns {Object} Renderer info
 */
export function getRendererInfo(renderer) {
  return {
    memory: { ...renderer.info.memory },
    render: { ...renderer.info.render },
    programs: renderer.info.programs?.length || 0
  };
}