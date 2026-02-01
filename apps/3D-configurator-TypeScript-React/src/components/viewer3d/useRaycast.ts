// src/components/viewer3d/useRaycast.ts
import { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { createRaycaster, type RaycastHit } from '@/three/core';
import { buildPoseFromHit } from '@/three/decal';
import { isUVInsidePrintZone } from '@/three/zones';
import { useCamera, usePrintZone, useConfiguratorStore } from '@/stores';
import type { ZoneRect } from '@/types';

interface UseRaycastOptions {
  targetObject?: THREE.Object3D | null;
  canvas?: HTMLCanvasElement | null;
  enabled?: boolean;
}

export function useRaycast(options: UseRaycastOptions = {}) {
  const { targetObject, canvas, enabled = true } = options;

  const camera = useCamera();
  const printZone = usePrintZone();

  const raycasterRef = useRef(createRaycaster());

  const performRaycast = useCallback(
    (event: { clientX: number; clientY: number }): RaycastHit | null => {
      if (!enabled || !camera || !targetObject || !canvas) {
        return null;
      }

      const hit = raycasterRef.current.hitTest(event, camera, targetObject, canvas);
      return hit;
    },
    [enabled, camera, targetObject, canvas]
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!enabled || !printZone) return;

      const hit = performRaycast(event);
      if (!hit || !hit.uv) return;

      // Check if hit is inside print zone
      if (!isUVInsidePrintZone(hit.uv, printZone)) {
        console.log('[Raycast] Click outside print zone');
        return;
      }

      console.log('[Raycast] Click at UV:', hit.uv.x.toFixed(3), hit.uv.y.toFixed(3));

      // Get store actions directly
      const store = useConfiguratorStore.getState();

      // Place artwork at UV
      store.placeAtUV({ x: hit.uv.x, y: hit.uv.y }, printZone);

      // Build decal pose
      const pose = buildPoseFromHit(hit);
      if (pose) {
        store.setDecalPose(pose);
      }
    },
    [enabled, printZone, performRaycast]
  );

  const getHitUV = useCallback(
    (event: { clientX: number; clientY: number }): THREE.Vector2 | null => {
      const hit = performRaycast(event);
      return hit?.uv ?? null;
    },
    [performRaycast]
  );

  const isInsideZone = useCallback(
    (uv: THREE.Vector2 | null, zone: ZoneRect | null): boolean => {
      return isUVInsidePrintZone(uv ? { x: uv.x, y: uv.y } : null, zone);
    },
    []
  );

  return {
    performRaycast,
    handleClick,
    getHitUV,
    isInsideZone,
  };
}
