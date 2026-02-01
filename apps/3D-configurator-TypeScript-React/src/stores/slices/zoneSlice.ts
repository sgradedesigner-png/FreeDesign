// src/stores/slices/zoneSlice.ts
import type { StateCreator } from 'zustand';
import type * as THREE from 'three';
import type { ZoneKey, ZoneRect, ZoneCM, ProductType } from '../../types/zone';
import type { ConfiguratorStore } from '../types';

export interface ZoneSlice {
  // State
  product: ProductType;
  zones: Map<ZoneKey, ZoneRect> | null;
  zoneMeshes: Map<ZoneKey, THREE.Mesh>;
  activeZoneKey: ZoneKey | 'all';
  printZone: ZoneRect | null;
  printZoneCM: ZoneCM | null;

  // Actions
  setProduct: (product: ProductType) => void;
  setZones: (zones: Map<ZoneKey, ZoneRect>) => void;
  setZoneMesh: (key: ZoneKey, mesh: THREE.Mesh) => void;
  removeZoneMesh: (key: ZoneKey) => void;
  setActiveZone: (key: ZoneKey | 'all') => void;
  setPrintZone: (zone: ZoneRect | null) => void;
  setPrintZoneCM: (zoneCM: ZoneCM | null) => void;
  getActiveZoneMesh: () => THREE.Mesh | undefined;
}

export const createZoneSlice: StateCreator<
  ConfiguratorStore,
  [['zustand/immer', never]],
  [],
  ZoneSlice
> = (set, get) => ({
  product: 'tshirt',
  zones: null,
  zoneMeshes: new Map(),
  activeZoneKey: 'front',
  printZone: null,
  printZoneCM: null,

  setProduct: (product) =>
    set((state) => {
      state.product = product;
    }),

  setZones: (zones) => set({ zones }),

  // External Three.js objects - bypass immer with new Map
  setZoneMesh: (key, mesh) =>
    set((state) => {
      const newMap = new Map(state.zoneMeshes);
      newMap.set(key, mesh);
      return { zoneMeshes: newMap };
    }),

  removeZoneMesh: (key) =>
    set((state) => {
      const newMap = new Map(state.zoneMeshes);
      newMap.delete(key);
      return { zoneMeshes: newMap };
    }),

  setActiveZone: (key) =>
    set((state) => {
      state.activeZoneKey = key;
    }),

  setPrintZone: (zone) => set({ printZone: zone }),

  setPrintZoneCM: (zoneCM) => set({ printZoneCM: zoneCM }),

  getActiveZoneMesh: () => {
    const state = get();
    if (state.activeZoneKey === 'all') return undefined;
    return state.zoneMeshes.get(state.activeZoneKey);
  },
});
