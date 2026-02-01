// src/hooks/useCameraMovement.ts
import { useCallback } from 'react';
import * as THREE from 'three';
import { useConfiguratorStore } from '@/stores';
import { ZONE_CAMERA_POSITIONS } from '@/config';
import type { ZoneKey } from '@/types';

export function useCameraMovement() {
  /**
   * Set model bounds for camera calculations
   */
  const setModelBounds = useCallback((object: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    useConfiguratorStore.getState().setModelBounds({
      size: { x: size.x, y: size.y, z: size.z },
      center: { x: center.x, y: center.y, z: center.z },
    });

    console.log('[setModelBounds] Size:', size.toArray(), 'Center:', center.toArray());
  }, []);

  /**
   * Fit camera to model
   */
  const fitCameraToModel = useCallback((fovMulti = 1.35) => {
    const store = useConfiguratorStore.getState();
    const { camera, controls, modelBounds } = store;

    if (!camera || !controls || !modelBounds) {
      console.warn('[fitCameraToModel] Missing camera, controls, or modelBounds');
      return;
    }

    const { size, center } = modelBounds;
    const maxDim = Math.max(size.x, size.y, size.z);

    const camFov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 50;
    const fovRad = (camFov * Math.PI) / 180;
    const dist = (maxDim / 2 / Math.tan(fovRad / 2)) * fovMulti;

    camera.position.set(center.x, center.y, center.z + dist);
    controls.target.set(center.x, center.y, center.z);

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.near = Math.max(0.01, dist / 100);
      camera.far = dist * 100;
      camera.updateProjectionMatrix();
    }

    controls.update();
    console.log('[fitCameraToModel] Distance:', dist);
  }, []);

  /**
   * Move camera to view specific zone
   */
  const moveCameraToZone = useCallback((zoneKey: ZoneKey | 'all') => {
    const store = useConfiguratorStore.getState();
    const { camera, controls, modelBounds } = store;

    if (!camera || !controls || !modelBounds) {
      console.warn('[moveCameraToZone] Missing camera, controls, or modelBounds');
      return;
    }

    const { size, center } = modelBounds;
    const maxDim = Math.max(size.x, size.y, size.z);

    const cameraPos = ZONE_CAMERA_POSITIONS[zoneKey];
    const dist = maxDim * cameraPos.distMultiplier;

    // Target is model center
    const target = new THREE.Vector3(center.x, center.y, center.z);

    // Calculate new position relative to center
    const pos = new THREE.Vector3(
      center.x + cameraPos.x * dist,
      center.y + cameraPos.y * dist,
      center.z + cameraPos.z * dist
    );

    // Apply to camera
    camera.position.copy(pos);
    controls.target.copy(target);
    camera.lookAt(target);
    controls.update();

    console.log('[moveCameraToZone]', zoneKey, 'pos:', pos.toArray(), 'target:', target.toArray());
  }, []);

  return {
    setModelBounds,
    fitCameraToModel,
    moveCameraToZone,
  };
}
