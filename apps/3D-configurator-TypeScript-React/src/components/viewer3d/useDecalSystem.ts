// src/components/viewer3d/useDecalSystem.ts
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
  useDecalPose,
  usePrintZone,
  usePrintZoneCM,
  useWorldZoneW,
  useConfiguratorStore,
} from '@/stores';

interface UseDecalSystemOptions {
  zoneMesh?: THREE.Mesh | null;
  flipU?: boolean;
}

export function useDecalSystem(options: UseDecalSystemOptions = {}) {
  const { zoneMesh, flipU = false } = options;

  const scene = useScene();
  const renderer = useRenderer();
  const currentImage = useCurrentImage();
  const currentPlacement = useCurrentPlacement();
  const decalPose = useDecalPose();
  const printZone = usePrintZone();
  const printZoneCM = usePrintZoneCM();
  const worldZoneW = useWorldZoneW();

  const materialRef = useRef<DecalMaterialResult | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);

  // Initialize material
  useEffect(() => {
    if (!renderer) return;

    const material = createDecalMaterial(renderer);
    materialRef.current = material;
    useConfiguratorStore.getState().setDecalMaterial(material.material);

    return () => {
      material.dispose();
      materialRef.current = null;
    };
  }, [renderer]);

  // Update texture when image changes
  useEffect(() => {
    if (!currentImage || !materialRef.current || !renderer) return;

    console.log('[Decal] Setting texture from image:', currentImage.width, 'x', currentImage.height);
    materialRef.current.setTexture(currentImage, renderer, { flipU });
  }, [currentImage, renderer, flipU]);

  // Build decal pose from placement
  const updatePoseFromPlacement = useCallback(() => {
    if (!zoneMesh || !currentPlacement || !printZone) {
      console.log('[Decal] updatePoseFromPlacement: Missing data', {
        zoneMesh: !!zoneMesh,
        currentPlacement: !!currentPlacement,
        printZone: !!printZone,
      });
      return;
    }

    // Convert placement UV to mesh UV
    const u = printZone.uMin + currentPlacement.u * (printZone.uMax - printZone.uMin);
    const v = printZone.vMin + currentPlacement.v * (printZone.vMax - printZone.vMin);

    console.log('[Decal] updatePoseFromPlacement:', {
      zoneName: printZone.name,
      placementUV: { u: currentPlacement.u, v: currentPlacement.v },
      zoneUV: { uMin: printZone.uMin, uMax: printZone.uMax, vMin: printZone.vMin, vMax: printZone.vMax },
      targetUV: { u, v },
    });

    const targetUV = new THREE.Vector2(u, v);
    const hit = pickOnMeshByUV(zoneMesh, targetUV, { wantWorldNormal: true });

    if (hit) {
      // Build pose from pick result
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
      if (printZone.correctionRad) {
        pose.baseOrientation.z += printZone.correctionRad;
      }

      useConfiguratorStore.getState().setDecalPose(pose);
    }
  }, [zoneMesh, currentPlacement, printZone]);

  // Calculate world size for the zone mesh
  const getZoneWorldSize = useCallback((mesh: THREE.Mesh): number => {
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    return Math.max(size.x, size.z);
  }, []);

  // Update decal mesh
  useEffect(() => {
    if (!scene || !decalPose || !currentPlacement || !materialRef.current || !printZoneCM || !zoneMesh || worldZoneW <= 0) {
      // Clear decal if conditions not met
      if (meshRef.current && scene) {
        disposeDecalMesh(meshRef.current, scene);
        meshRef.current = null;
        useConfiguratorStore.getState().setDecalMesh(null);
      }
      return;
    }

    // Calculate size based on zone-specific world size (not global worldZoneW)
    const zoneWorldSize = getZoneWorldSize(zoneMesh);
    const widthWorld = currentPlacement.uScale * zoneWorldSize;
    const heightWorld = currentPlacement.vScale * zoneWorldSize;

    console.log('[Decal] Using zone-specific worldSize:', zoneWorldSize);
    console.log('[Decal] Placement scale:', currentPlacement.uScale, currentPlacement.vScale);
    console.log('[Decal] Decal size:', widthWorld, 'x', heightWorld);

    // Dispose old mesh
    if (meshRef.current) {
      disposeDecalMesh(meshRef.current, scene);
    }

    // Build new mesh
    const mesh = buildDecalMesh(
      decalPose,
      { width: widthWorld, height: heightWorld, depth: DECAL_DEPTH },
      currentPlacement.rotationRad,
      materialRef.current.material
    );
    mesh.name = 'DecalMesh';

    scene.add(mesh);
    meshRef.current = mesh;
    useConfiguratorStore.getState().setDecalMesh(mesh);

    console.log('[Decal] Built mesh at:', decalPose.position.toArray());
  }, [scene, decalPose, currentPlacement, printZoneCM, zoneMesh, worldZoneW, getZoneWorldSize]);

  // Update pose when placement changes
  useEffect(() => {
    if (currentPlacement && zoneMesh && printZone) {
      updatePoseFromPlacement();
    }
  }, [currentPlacement, zoneMesh, printZone, updatePoseFromPlacement]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (meshRef.current && scene) {
        disposeDecalMesh(meshRef.current, scene);
        meshRef.current = null;
      }
    };
  }, [scene]);

  const clearDecal = useCallback(() => {
    useConfiguratorStore.getState().clearDecal();
  }, []);

  return {
    material: materialRef.current,
    mesh: meshRef.current,
    updatePoseFromPlacement,
    clearDecal,
  };
}
