// src/components/viewer3d/useGLTFLoader.ts
import { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { useConfiguratorStore, useScene } from '@/stores';
import { attachToGroup, type SceneGroups } from '@/three/core';
import { buildPrintZoneFromMesh } from '@/three/zones';
import { getZoneCM } from '@/config';
import type { ZoneKey } from '@/types';

interface UseGLTFLoaderOptions {
  groups?: SceneGroups;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  onLoad?: (modelScene: THREE.Group) => void;
}

interface LoadedModel {
  scene: THREE.Group;
  meshes: Map<string, THREE.Mesh>;
  zoneMeshes: Map<ZoneKey, THREE.Mesh>;
}

// Zone name mapping - supports multiple naming conventions
const ZONE_MESH_NAMES: Record<string, ZoneKey> = {
  // Simple names
  front: 'front',
  Front: 'front',
  back: 'back',
  Back: 'back',
  left_arm: 'left_arm',
  LeftArm: 'left_arm',
  right_arm: 'right_arm',
  RightArm: 'right_arm',
  // PRINT_ZONE_* convention
  PRINT_ZONE_FRONT: 'front',
  PRINT_ZONE_BACK: 'back',
  PRINT_ZONE_LEFT_ARM: 'left_arm',
  PRINT_ZONE_RIGHT_ARM: 'right_arm',
  // PrintZone* convention
  PrintZoneFront: 'front',
  PrintZoneBack: 'back',
  PrintZoneLeftArm: 'left_arm',
  PrintZoneRightArm: 'right_arm',
};

export function useGLTFLoader(
  url: string | null,
  options: UseGLTFLoaderOptions = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [model, setModel] = useState<LoadedModel | null>(null);
  const loadedRef = useRef(false);

  const scene = useScene();

  // Store callbacks in refs to avoid dependency issues
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!url || !scene || loadedRef.current) return;

    const loadModel = async () => {
      loadedRef.current = true;
      setLoading(true);
      setError(null);

      try {
        // Setup loaders
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(dracoLoader);

        // Load model
        const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
          loader.load(
            url,
            resolve,
            (event) => {
              if (event.lengthComputable) {
                optionsRef.current.onProgress?.(event.loaded / event.total);
              }
            },
            reject
          );
        });

        const modelScene = gltf.scene;
        modelScene.name = 'LoadedModel';

        // Collect meshes and materials
        const meshes = new Map<string, THREE.Mesh>();
        const zoneMeshes = new Map<ZoneKey, THREE.Mesh>();
        const materials: THREE.Material[] = [];

        // Get store actions directly
        const store = useConfiguratorStore.getState();

        console.log('[useGLTFLoader] Scanning model for meshes...');
        modelScene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            meshes.set(mesh.name, mesh);
            console.log('[useGLTFLoader] Found mesh:', mesh.name);

            // Check if this is a zone mesh
            const zoneKey = ZONE_MESH_NAMES[mesh.name];
            if (zoneKey) {
              console.log('[useGLTFLoader] Matched zone mesh:', mesh.name, '→', zoneKey);
              zoneMeshes.set(zoneKey, mesh);
              store.setZoneMesh(zoneKey, mesh);
            }

            // Collect materials
            const meshMaterials = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material];
            materials.push(...meshMaterials);
          }
        });
        console.log('[useGLTFLoader] Total zone meshes found:', zoneMeshes.size);

        // Add to scene
        if (optionsRef.current.groups) {
          attachToGroup(optionsRef.current.groups, modelScene, 'product');
        } else {
          scene.add(modelScene);
        }

        // Build all zones
        console.log('[useGLTFLoader] Building zones...');
        const allZones = new Map<ZoneKey, ReturnType<typeof buildPrintZoneFromMesh>>();
        for (const [zoneKey, mesh] of zoneMeshes) {
          const zoneRect = buildPrintZoneFromMesh(mesh, zoneKey);
          console.log('[useGLTFLoader] Built zone:', zoneKey, {
            uMin: zoneRect.uMin,
            uMax: zoneRect.uMax,
            hasOutline: zoneRect.outline !== null,
            outlinePoints: zoneRect.outline?.length ?? 0,
          });
          allZones.set(zoneKey, zoneRect);
        }
        console.log('[useGLTFLoader] Total zones built:', allZones.size);
        store.setZones(allZones);

        // Setup initial zone (front)
        const frontMesh = zoneMeshes.get('front');
        const frontZone = allZones.get('front');
        if (frontMesh && frontZone) {
          const printZoneCM = getZoneCM('tshirt', 'front');
          store.setPrintZone(frontZone);
          if (printZoneCM) store.setPrintZoneCM(printZoneCM);
          store.setActiveZone('front');

          // Calculate worldZoneW from front zone mesh (used for all zones)
          const box = new THREE.Box3().setFromObject(frontMesh);
          const size = box.getSize(new THREE.Vector3());
          const worldZoneW = Math.max(size.x, size.z);
          store.setWorldZoneW(worldZoneW);
          console.log('[useGLTFLoader] Set worldZoneW:', worldZoneW, 'from front mesh size:', size.toArray());
        }

        // Store
        store.setBaseMaterials(materials);
        store.setModelLoaded(true);

        setModel({ scene: modelScene, meshes, zoneMeshes });

        // Notify about load complete
        optionsRef.current.onLoad?.(modelScene);

        // Cleanup draco
        dracoLoader.dispose();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load model');
        setError(error);
        optionsRef.current.onError?.(error);
      } finally {
        setLoading(false);
      }
    };

    loadModel();
  }, [url, scene]);

  const reload = () => {
    loadedRef.current = false;
  };

  return { loading, error, model, reload };
}
