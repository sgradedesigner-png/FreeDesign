// src/stores/slices/decalSlice.ts
import type { StateCreator } from 'zustand';
import type * as THREE from 'three';
import type { DecalPose } from '../../three/decal/decalPose';
import type { ConfiguratorStore } from '../types';

export interface DecalSlice {
  // State
  decalMesh: THREE.Mesh | null;
  decalPose: DecalPose | null;
  decalMaterial: THREE.Material | null;

  // Actions
  setDecalMesh: (mesh: THREE.Mesh | null) => void;
  setDecalPose: (pose: DecalPose | null) => void;
  setDecalMaterial: (material: THREE.Material | null) => void;
  clearDecal: () => void;
}

export const createDecalSlice: StateCreator<
  ConfiguratorStore,
  [['zustand/immer', never]],
  [],
  DecalSlice
> = (set, get) => ({
  decalMesh: null,
  decalPose: null,
  decalMaterial: null,

  // External Three.js objects - bypass immer
  setDecalMesh: (mesh) => set({ decalMesh: mesh }),
  setDecalPose: (pose) => set({ decalPose: pose }),
  setDecalMaterial: (material) => set({ decalMaterial: material }),

  clearDecal: () => {
    const { decalMesh } = get();
    if (decalMesh?.geometry) {
      decalMesh.geometry.dispose();
    }
    set({ decalMesh: null, decalPose: null });
  },
});
