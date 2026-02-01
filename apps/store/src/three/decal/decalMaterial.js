// src/three/decal/decalMaterial.js
// ✅ REACT руу шилжүүлсэн

import * as THREE from 'three';

let artworkTexture = null;

/**
 * Create decal material for artwork
 * @param {THREE.WebGLRenderer} renderer - Three.js renderer
 * @returns {Object} Object with material property
 */
export function createDecalMaterial(renderer) {
  const mat = new THREE.MeshStandardMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    color: 0xffffff, // White to show texture without darkening
  });
  
  if (renderer) mat.needsUpdate = true;
  
  return { material: mat };
}

/**
 * Set artwork texture from image
 * @param {HTMLImageElement} img - Source image
 * @param {THREE.Material} material - Target material
 * @param {THREE.WebGLRenderer} renderer - Renderer for anisotropy
 * @param {Object} opts - Options {flipU: boolean}
 */
export function setArtworkTextureFromImage(img, material, renderer, opts = {}) {
  if (!material || !img) return;

  const { flipU = false } = opts;

  // Dispose old texture
  if (artworkTexture) {
    artworkTexture.dispose();
    artworkTexture = null;
  }

  // Create new texture
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;

  // ✅ IMPORTANT: Use RepeatWrapping if flipping
  tex.wrapS = flipU ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;

  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 1;

  // Apply flip if requested
  if (flipU) {
    tex.repeat.set(-1, 1);
    tex.offset.set(1, 0);
  } else {
    tex.repeat.set(1, 1);
    tex.offset.set(0, 0);
  }

  tex.needsUpdate = true;

  // Apply to material
  material.map = tex;
  material.needsUpdate = true;
  artworkTexture = tex;
}

/**
 * Check if artwork texture exists
 * @returns {boolean}
 */
export function hasArtworkTexture() {
  return !!artworkTexture;
}

/**
 * Get current artwork texture
 * @returns {THREE.Texture|null}
 */
export function getArtworkTexture() {
  return artworkTexture;
}

/**
 * Dispose artwork texture
 */
export function disposeArtworkTexture() {
  if (artworkTexture) {
    artworkTexture.dispose();
    artworkTexture = null;
  }
}