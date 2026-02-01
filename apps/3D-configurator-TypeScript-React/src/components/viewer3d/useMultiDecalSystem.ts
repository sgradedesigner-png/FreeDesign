// src/components/viewer3d/useMultiDecalSystem.ts
import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import {
  createDecalMaterial,
  buildDecalMesh,
  disposeDecalMesh,
  type DecalMaterialResult,
} from '@/three/decal';
import { pickOnMeshByUV } from '@/three/zones';
import { DECAL_DEPTH } from '@/config';
import {
  useScene,
  useRenderer,
  useCurrentImage,
  useCurrentPlacement,
  usePrintZone,
  usePrintZoneCM,
  useWorldZoneW,
  useConfiguratorStore,
  useZoneDrafts,
} from '@/stores';
import type { ZoneKey, ZoneRect } from '@/types';

interface ZoneDecalState {
  material: DecalMaterialResult;
  mesh: THREE.Mesh | null;
}

const ZONE_KEYS: ZoneKey[] = ['front', 'back', 'left_arm', 'right_arm'];

/**
 * Multi-decal system that renders decals for ALL zones with drafts
 * - Active zone uses real-time placement updates
 * - Non-active zones use their saved draft placements
 */
export function useMultiDecalSystem() {
  const scene = useScene();
  const renderer = useRenderer();
  const currentImage = useCurrentImage();
  const currentPlacement = useCurrentPlacement();
  const printZone = usePrintZone();
  const printZoneCM = usePrintZoneCM();
  const worldZoneW = useWorldZoneW();
  const zoneDrafts = useZoneDrafts();

  // Get active zone and all zone data
  const activeZoneKey = useConfiguratorStore((s) => s.activeZoneKey);
  const zones = useConfiguratorStore((s) => s.zones);
  const zoneMeshes = useConfiguratorStore((s) => s.zoneMeshes);

  // Per-zone decal states
  const zoneDecals = useRef<Map<ZoneKey, ZoneDecalState>>(new Map());

  // Initialize materials for all zones
  useEffect(() => {
    if (!renderer) return;

    // Create materials for each zone
    for (const zoneKey of ZONE_KEYS) {
      if (!zoneDecals.current.has(zoneKey)) {
        const material = createDecalMaterial(renderer);
        zoneDecals.current.set(zoneKey, {
          material,
          mesh: null,
        });
      }
    }

    return () => {
      // Cleanup all materials
      for (const [, state] of zoneDecals.current) {
        state.material.dispose();
        if (state.mesh && scene) {
          disposeDecalMesh(state.mesh, scene);
        }
      }
      zoneDecals.current.clear();
    };
  }, [renderer, scene]);

  // Calculate world size for a specific zone mesh
  const getZoneWorldSize = useCallback((zoneMesh: THREE.Mesh): number => {
    const box = new THREE.Box3().setFromObject(zoneMesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    return Math.max(size.x, size.z);
  }, []);

  // Build decal for a specific zone
  const buildZoneDecal = useCallback(
    (
      zoneKey: ZoneKey,
      image: HTMLImageElement,
      placement: { u: number; v: number; uScale: number; vScale: number; rotationRad: number },
      zoneRect: ZoneRect
    ) => {
      console.log('[MultiDecal] buildZoneDecal called:', {
        zoneKey,
        hasScene: !!scene,
        hasRenderer: !!renderer,
        worldZoneW,
        imageSize: `${image.width}x${image.height}`,
        placement,
      });

      if (!scene || !renderer || worldZoneW <= 0) {
        console.log('[MultiDecal] buildZoneDecal early return: scene/renderer/worldZoneW issue');
        return;
      }

      const zoneMesh = zoneMeshes.get(zoneKey);
      if (!zoneMesh) {
        console.log('[MultiDecal] buildZoneDecal early return: no zoneMesh for', zoneKey);
        console.log('[MultiDecal] Available zoneMeshes:', Array.from(zoneMeshes.keys()));
        return;
      }

      const decalState = zoneDecals.current.get(zoneKey);
      if (!decalState) {
        console.log('[MultiDecal] buildZoneDecal early return: no decalState');
        return;
      }

      // Set texture (with flipU for front, back, and left_arm zones - UV is mirrored)
      const flipU = zoneKey === 'front' || zoneKey === 'back' || zoneKey === 'left_arm';
      decalState.material.setTexture(image, renderer, { flipU });

      // Convert placement UV to mesh UV
      const u = zoneRect.uMin + placement.u * (zoneRect.uMax - zoneRect.uMin);
      const v = zoneRect.vMin + placement.v * (zoneRect.vMax - zoneRect.vMin);

      const targetUV = new THREE.Vector2(u, v);
      console.log('[MultiDecal] Picking UV:', { u, v, zoneRect });
      const hit = pickOnMeshByUV(zoneMesh, targetUV, { wantWorldNormal: true });

      if (!hit) {
        console.log('[MultiDecal] UV pick failed - no hit');
        return;
      }
      console.log('[MultiDecal] UV pick success:', hit.point.toArray());

      // Build pose
      const pose = {
        object: hit.object,
        position: hit.point,
        baseOrientation: new THREE.Euler().setFromRotationMatrix(
          new THREE.Matrix4().lookAt(
            hit.point,
            hit.point.clone().add(hit.face.normal),
            new THREE.Vector3(0, 1, 0)
          )
        ),
      };

      // Apply zone correction rotation
      if (zoneRect.correctionRad) {
        pose.baseOrientation.z += zoneRect.correctionRad;
      }

      // Calculate size using zone-specific world size (not global worldZoneW for arm zones)
      const zoneWorldSize = getZoneWorldSize(zoneMesh);
      const widthWorld = placement.uScale * zoneWorldSize;
      const heightWorld = placement.vScale * zoneWorldSize;
      console.log('[MultiDecal] Zone world size:', { zoneKey, zoneWorldSize, widthWorld, heightWorld });

      // Dispose old mesh
      if (decalState.mesh) {
        disposeDecalMesh(decalState.mesh, scene);
      }

      // Build new mesh
      const mesh = buildDecalMesh(
        pose,
        { width: widthWorld, height: heightWorld, depth: DECAL_DEPTH },
        placement.rotationRad,
        decalState.material.material
      );
      mesh.name = `DecalMesh_${zoneKey}`;

      scene.add(mesh);
      decalState.mesh = mesh;

      // Update store for active zone
      if (zoneKey === activeZoneKey) {
        useConfiguratorStore.getState().setDecalMesh(mesh);
        useConfiguratorStore.getState().setDecalPose(pose);
      }
    },
    [scene, renderer, worldZoneW, zoneMeshes, activeZoneKey, getZoneWorldSize]
  );

  // Clear decal for a specific zone
  const clearZoneDecal = useCallback(
    (zoneKey: ZoneKey) => {
      if (!scene) return;

      const decalState = zoneDecals.current.get(zoneKey);
      if (!decalState) return;

      if (decalState.mesh) {
        disposeDecalMesh(decalState.mesh, scene);
        decalState.mesh = null;
      }
    },
    [scene]
  );

  // Update active zone decal (real-time)
  useEffect(() => {
    console.log('[MultiDecal] Active zone effect triggered:', {
      activeZoneKey,
      hasCurrentImage: !!currentImage,
      hasCurrentPlacement: !!currentPlacement,
      hasPrintZone: !!printZone,
      hasPrintZoneCM: !!printZoneCM,
      worldZoneW,
      zoneMeshesSize: zoneMeshes.size,
    });

    if (activeZoneKey === 'all') {
      console.log('[MultiDecal] Skipping: all zones view');
      return;
    }
    if (!currentImage || !currentPlacement || !printZone || !printZoneCM) {
      console.log('[MultiDecal] Missing data, clearing decal');
      clearZoneDecal(activeZoneKey);
      return;
    }

    console.log('[MultiDecal] Building decal for zone:', activeZoneKey);
    buildZoneDecal(activeZoneKey, currentImage, currentPlacement, printZone);
  }, [
    activeZoneKey,
    currentImage,
    currentPlacement,
    printZone,
    printZoneCM,
    buildZoneDecal,
    clearZoneDecal,
  ]);

  // Update non-active zone decals from drafts
  useEffect(() => {
    if (!zones) return;

    for (const zoneKey of ZONE_KEYS) {
      // Skip active zone (handled by real-time update above)
      if (zoneKey === activeZoneKey) continue;

      const draft = zoneDrafts.get(zoneKey);
      const zoneRect = zones.get(zoneKey);

      if (!draft?.image || !draft?.placement || !zoneRect) {
        clearZoneDecal(zoneKey);
        continue;
      }

      buildZoneDecal(zoneKey, draft.image, draft.placement, zoneRect);
    }
  }, [zoneDrafts, zones, activeZoneKey, buildZoneDecal, clearZoneDecal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scene) {
        for (const [, state] of zoneDecals.current) {
          if (state.mesh) {
            disposeDecalMesh(state.mesh, scene);
          }
        }
      }
    };
  }, [scene]);

  const clearAllDecals = useCallback(() => {
    for (const zoneKey of ZONE_KEYS) {
      clearZoneDecal(zoneKey);
    }
    useConfiguratorStore.getState().clearDecal();
  }, [clearZoneDecal]);

  return {
    clearAllDecals,
  };
}
