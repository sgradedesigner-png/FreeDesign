// src/three/zones/zoneMetrics.js
// ✅ REACT руу шилжүүлсэн

/**
 * Convert UV coordinates to print centimeters
 * @param {Object} uv - {x, y} UV coordinates
 * @param {Object} printZone - {uMin, uMax, vMin, vMax}
 * @param {Object} printZoneCM - {width, height} in cm
 * @returns {Object} {x_cm, y_cm} coordinates in cm
 */
export function uvToPrintCM(uv, printZone, printZoneCM) {
  if (!printZone || !printZoneCM) return { x_cm: 0, y_cm: 0 };

  // Normalize UV to zone-local coordinates (0-1)
  const uRel = (uv.x - printZone.uMin) / Math.max(1e-6, printZone.uMax - printZone.uMin);
  const vRel = (uv.y - printZone.vMin) / Math.max(1e-6, printZone.vMax - printZone.vMin);

  // Convert to centimeters
  // V is flipped: v=0 is bottom, v=1 is top in UV, but we want top-to-bottom in cm
  const x_cm = uRel * printZoneCM.width;
  const y_cm = (1 - vRel) * printZoneCM.height;

  return { x_cm, y_cm };
}

/**
 * Convert print centimeters to UV coordinates
 * @param {Object} cm - {x_cm, y_cm} coordinates in cm
 * @param {Object} printZone - {uMin, uMax, vMin, vMax}
 * @param {Object} printZoneCM - {width, height} in cm
 * @returns {Object} {x, y} UV coordinates
 */
export function printCMToUV(cm, printZone, printZoneCM) {
  if (!printZone || !printZoneCM) return { x: 0, y: 0 };

  // Convert cm to relative coordinates (0-1)
  const uRel = cm.x_cm / printZoneCM.width;
  const vRel = 1 - (cm.y_cm / printZoneCM.height); // Flip V

  // Convert to absolute UV
  const x = printZone.uMin + uRel * (printZone.uMax - printZone.uMin);
  const y = printZone.vMin + vRel * (printZone.vMax - printZone.vMin);

  return { x, y };
}

/**
 * Calculate artwork dimensions in cm
 * @param {Object} placement - {uScale, vScale}
 * @param {Object} printZoneCM - {width, height} in cm
 * @returns {Object} {width_cm, height_cm}
 */
export function getArtworkDimensionsCM(placement, printZoneCM) {
  if (!placement || !printZoneCM) return { width_cm: 0, height_cm: 0 };

  return {
    width_cm: placement.uScale * printZoneCM.width,
    height_cm: placement.vScale * printZoneCM.height
  };
}

/**
 * Calculate artwork position in cm
 * @param {Object} placement - {u, v}
 * @param {Object} printZoneCM - {width, height} in cm
 * @returns {Object} {x_cm, y_cm}
 */
export function getArtworkPositionCM(placement, printZoneCM) {
  if (!placement || !printZoneCM) return { x_cm: 0, y_cm: 0 };

  return {
    x_cm: placement.u * printZoneCM.width,
    y_cm: (1 - placement.v) * printZoneCM.height
  };
}

/**
 * Calculate DPI based on image size and print size
 * @param {number} imageWidth - Image width in pixels
 * @param {number} printWidthCM - Print width in cm
 * @returns {number} DPI
 */
export function calculateDPI(imageWidth, printWidthCM) {
  if (printWidthCM <= 0) return 0;
  const printWidthInches = printWidthCM / 2.54;
  return imageWidth / printWidthInches;
}

/**
 * Check if DPI is sufficient for print quality
 * @param {number} dpi - Dots per inch
 * @param {number} minDPI - Minimum acceptable DPI (default 150)
 * @returns {Object} {ok: boolean, quality: string}
 */
export function evaluateDPI(dpi, minDPI = 150) {
  if (dpi >= 300) {
    return { ok: true, quality: 'excellent' };
  } else if (dpi >= 200) {
    return { ok: true, quality: 'good' };
  } else if (dpi >= minDPI) {
    return { ok: true, quality: 'acceptable' };
  } else {
    return { ok: false, quality: 'poor' };
  }
}

/**
 * Get recommended print size for image
 * @param {number} imageWidth - Image width in pixels
 * @param {number} imageHeight - Image height in pixels
 * @param {number} targetDPI - Target DPI (default 300)
 * @returns {Object} {width_cm, height_cm}
 */
export function getRecommendedPrintSize(imageWidth, imageHeight, targetDPI = 300) {
  const widthInches = imageWidth / targetDPI;
  const heightInches = imageHeight / targetDPI;
  
  return {
    width_cm: widthInches * 2.54,
    height_cm: heightInches * 2.54
  };
}