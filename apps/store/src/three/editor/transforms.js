// src/three/editor/transforms.js
// ✅ REACT руу шилжүүлсэн

/**
 * Project world position to screen pixel coordinates
 * @param {THREE.Vector3} pos - World position
 * @param {THREE.Camera} camera - Camera
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @returns {Object} {x, y} Screen coordinates
 */
export function worldToScreen(pos, camera, canvas) {
  const v = pos.clone().project(camera);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  return {
    x: (v.x * 0.5 + 0.5) * w,
    y: (-v.y * 0.5 + 0.5) * h
  };
}

/**
 * Project screen coordinates to world ray
 * @param {number} x - Screen x coordinate
 * @param {number} y - Screen y coordinate
 * @param {THREE.Camera} camera - Camera
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @returns {Object} {origin, direction} Ray in world space
 */
export function screenToWorldRay(x, y, camera, canvas) {
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((x - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((y - rect.top) / rect.height) * 2 + 1;

  const origin = camera.position.clone();
  const direction = new THREE.Vector3(ndcX, ndcY, 0.5);
  direction.unproject(camera);
  direction.sub(origin).normalize();

  return { origin, direction };
}

/**
 * Get mouse position relative to canvas
 * @param {MouseEvent|TouchEvent} event - Mouse or touch event
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @returns {Object} {x, y} Canvas-relative coordinates
 */
export function getCanvasMousePosition(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  
  let clientX, clientY;
  if (event.touches && event.touches.length > 0) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }

  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

/**
 * Convert canvas coordinates to normalized coordinates (0-1)
 * @param {number} x - Canvas x
 * @param {number} y - Canvas y
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @returns {Object} {x, y} Normalized coordinates
 */
export function canvasToNormalized(x, y, canvas) {
  return {
    x: x / canvas.width,
    y: y / canvas.height
  };
}