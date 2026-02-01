// src/three/core/raycast.ts
import * as THREE from 'three';

/** Raycast hit result */
export interface RaycastHit extends THREE.Intersection {
  object: THREE.Object3D;
}

/**
 * Convert pointer event to Normalized Device Coordinates
 */
export function eventToNDC(
  event: { clientX: number; clientY: number },
  canvas: HTMLElement
): THREE.Vector2 {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / Math.max(1, rect.width);
  const y = (event.clientY - rect.top) / Math.max(1, rect.height);
  return new THREE.Vector2(x * 2 - 1, -(y * 2 - 1));
}

/**
 * Perform a raycast hit test
 */
export function hitTest(
  event: { clientX: number; clientY: number },
  camera: THREE.Camera,
  object: THREE.Object3D,
  canvas: HTMLElement
): RaycastHit | null {
  if (!object) return null;

  const raycaster = new THREE.Raycaster();
  const ndc = eventToNDC(event, canvas);
  raycaster.setFromCamera(ndc, camera);

  const hits = raycaster.intersectObject(object, true);
  return hits.length ? (hits[0] as RaycastHit) : null;
}

/**
 * Raycast from a specific UV point on a mesh
 */
export function raycastFromUV(
  uv: THREE.Vector2,
  camera: THREE.Camera,
  object: THREE.Object3D
): RaycastHit | null {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(uv, camera);

  const hits = raycaster.intersectObject(object, true);
  return hits.length ? (hits[0] as RaycastHit) : null;
}

/**
 * Create a reusable raycaster instance
 */
export function createRaycaster(): {
  raycaster: THREE.Raycaster;
  hitTest: (
    event: { clientX: number; clientY: number },
    camera: THREE.Camera,
    object: THREE.Object3D,
    canvas: HTMLElement
  ) => RaycastHit | null;
} {
  const raycaster = new THREE.Raycaster();
  const mouseNDC = new THREE.Vector2();

  return {
    raycaster,
    hitTest: (event, camera, object, canvas) => {
      if (!object) return null;

      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(1, rect.width);
      const y = (event.clientY - rect.top) / Math.max(1, rect.height);
      mouseNDC.set(x * 2 - 1, -(y * 2 - 1));

      raycaster.setFromCamera(mouseNDC, camera);
      const hits = raycaster.intersectObject(object, true);
      return hits.length ? (hits[0] as RaycastHit) : null;
    },
  };
}
