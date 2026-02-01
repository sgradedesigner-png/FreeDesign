// src/stores/slices/sceneSlice.ts
import type { StateCreator } from 'zustand';
import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ConfiguratorStore } from '../types';

export interface ModelBounds {
  size: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
}

export interface SceneSlice {
  // State
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  controls: OrbitControls | null;
  modelLoaded: boolean;
  modelBounds: ModelBounds | null;
  worldZoneW: number;
  baseColor: string;
  baseMaterials: THREE.Material[];

  // Actions
  setScene: (scene: THREE.Scene) => void;
  setCamera: (camera: THREE.PerspectiveCamera) => void;
  setRenderer: (renderer: THREE.WebGLRenderer) => void;
  setControls: (controls: OrbitControls) => void;
  setModelLoaded: (loaded: boolean) => void;
  setModelBounds: (bounds: ModelBounds) => void;
  setWorldZoneW: (width: number) => void;
  setBaseColor: (color: string) => void;
  setBaseMaterials: (materials: THREE.Material[]) => void;
  resetScene: () => void;
}

const initialSceneState = {
  scene: null as THREE.Scene | null,
  camera: null as THREE.PerspectiveCamera | null,
  renderer: null as THREE.WebGLRenderer | null,
  controls: null as OrbitControls | null,
  modelLoaded: false,
  modelBounds: null as ModelBounds | null,
  worldZoneW: 0.9, // Default, will be calculated from front zone
  baseColor: '#ffffff',
  baseMaterials: [] as THREE.Material[],
};

export const createSceneSlice: StateCreator<
  ConfiguratorStore,
  [['zustand/immer', never]],
  [],
  SceneSlice
> = (set) => ({
  ...initialSceneState,

  // External Three.js objects - bypass immer
  setScene: (scene) => set({ scene }),
  setCamera: (camera) => set({ camera }),
  setRenderer: (renderer) => set({ renderer }),
  setControls: (controls) => set({ controls }),
  setBaseMaterials: (materials) => set({ baseMaterials: materials }),
  setModelBounds: (bounds) => set({ modelBounds: bounds }),
  setWorldZoneW: (width) => set({ worldZoneW: width }),

  // Primitive values - can use immer
  setModelLoaded: (loaded) =>
    set((state) => {
      state.modelLoaded = loaded;
    }),

  setBaseColor: (color) =>
    set((state) => {
      state.baseColor = color;
    }),

  resetScene: () => set(initialSceneState),
});
