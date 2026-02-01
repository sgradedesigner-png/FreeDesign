// src/three/editor/placement.js
// ✅ REACT руу шилжүүлсэн

import { clamp } from './clamp.js';

/**
 * Create artwork controller for managing image placement
 * @param {Object} options - {onUpdate: Function}
 * @returns {Object} API object
 */
export function createArtworkController({ onUpdate } = {}) {
  let image = null;
  let placement = null; // { u, v, uScale, vScale, rotationRad }

  const api = {
    /**
     * Set artwork image
     */
    setImage(img) { 
      image = img; 
      onUpdate?.(); 
    },
    
    /**
     * Get current image
     */
    getImage() { 
      return image; 
    },
    
    /**
     * Check if image exists
     */
    hasImage() { 
      return !!image; 
    },

    /**
     * Set placement data
     */
    setPlacement(p) { 
      placement = { ...placement, ...p }; 
      onUpdate?.(); 
    },
    
    /**
     * Get current placement
     */
    getPlacement() { 
      return placement; 
    },
    
    /**
     * Check if placement exists
     */
    hasPlacement() { 
      return !!placement; 
    },

    /**
     * Clear image and placement
     */
    clear() { 
      image = null; 
      placement = null; 
      onUpdate?.(); 
    },

    /**
     * Place artwork at UV coordinates inside print zone
     * @param {Object} hitUV - {x, y} UV coordinates
     * @param {Object} printZone - {uMin, uMax, vMin, vMax}
     */
    placeAtUV(hitUV, printZone) {
      const u = (hitUV.x - printZone.uMin) / Math.max(1e-6, (printZone.uMax - printZone.uMin));
      const v = (hitUV.y - printZone.vMin) / Math.max(1e-6, (printZone.vMax - printZone.vMin));
      
      if (!placement) {
        placement = { u, v, uScale: 0.3, vScale: 0.3, rotationRad: 0 };
      } else {
        placement.u = u; 
        placement.v = v;
      }
      onUpdate?.();
    },

    /**
     * Scale artwork by factor
     * @param {number} f - Scale factor (1.0 = no change)
     */
    scaleBy(f) {
      if (!placement) return;
      placement.uScale = clamp(placement.uScale * f, 0.05, 1.2);
      placement.vScale = clamp(placement.vScale * f, 0.05, 1.2);
      onUpdate?.();
    },

    /**
     * Rotate artwork by degrees
     * @param {number} deg - Rotation in degrees
     */
    rotateByDeg(deg) {
      if (!placement) return;
      const r = (deg * Math.PI) / 180;
      placement.rotationRad = (placement.rotationRad || 0) + r;
      onUpdate?.();
    },
  };

  return api;
}

/**
 * Convert placement to centimeters
 * @param {Object} p - Placement {u, v, uScale, vScale}
 * @param {Object} printZoneCM - {width, height} in cm
 * @returns {Object} {width_cm, height_cm, x_cm, y_cm}
 */
export function placementToCm(p, printZoneCM) {
  return {
    width_cm: p.uScale * printZoneCM.width,
    height_cm: p.vScale * printZoneCM.height,
    x_cm: p.u * printZoneCM.width,
    y_cm: (1 - p.v) * printZoneCM.height
  };
}

/**
 * Convert centimeter width to placement scale
 * @param {number} widthCm - Width in cm
 * @param {Object} printZoneCM - {width, height}
 * @returns {number} uScale value
 */
export function cmToPlacementWidth(widthCm, printZoneCM) {
  return clamp(widthCm / printZoneCM.width, 0.05, 1.2);
}

/**
 * Apply snap to placement (center/grid)
 * @param {Object} p - Placement object
 * @param {Object} opts - Options {enableCenterSnap, enableGridSnap, gridCm, printZoneCM, shiftKey}
 * @returns {Object} Snapped placement
 */
export function applySnap(p, {
  enableCenterSnap,
  enableGridSnap,
  gridCm,
  printZoneCM,
  shiftToDisable = false,
  shiftKey = false,
}) {
  if (shiftToDisable && shiftKey) return p;

  const r = { ...p };

  // Center snap
  if (enableCenterSnap) {
    const eps = 0.02;
    if (Math.abs(r.u - 0.5) < eps) r.u = 0.5;
    if (Math.abs(r.v - 0.5) < eps) r.v = 0.5;
  }

  // Grid snap
  if (enableGridSnap && gridCm > 0) {
    const snap = (val) => Math.round(val / gridCm) * gridCm;
    const x = snap(r.u * printZoneCM.width);
    const y = snap((1 - r.v) * printZoneCM.height);
    r.u = clamp(x / printZoneCM.width, 0, 1);
    r.v = clamp(1 - (y / printZoneCM.height), 0, 1);
  }

  return r;
}