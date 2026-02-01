// src/three/editor/clamp.js
// ✅ REACT руу шилжүүлсэн - Өөрчлөлтгүй

/**
 * Clamp a value between min and max
 * @param {number} x - Value to clamp
 * @param {number} a - Minimum value
 * @param {number} b - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(x, a, b) {
  return Math.min(b, Math.max(a, x));
}

/**
 * Clamp value to 0-1 range
 * @param {number} x - Value to clamp
 * @returns {number} Clamped value between 0 and 1
 */
export function clamp01(x) {
  return clamp(x, 0, 1);
}

/**
 * Linear interpolation
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
  return a + (b - a) * clamp01(t);
}