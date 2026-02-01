// src/stores/useConfiguratorStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import { enableMapSet } from 'immer';

// Enable Immer plugin for Map and Set support
enableMapSet();

import type { ConfiguratorStore } from './types';
import {
  createSceneSlice,
  createZoneSlice,
  createArtworkSlice,
  createDecalSlice,
  createUISlice,
  createExportSlice,
} from './slices';

export const useConfiguratorStore = create<ConfiguratorStore>()(
  devtools(
    immer((...a) => ({
      ...createSceneSlice(...a),
      ...createZoneSlice(...a),
      ...createArtworkSlice(...a),
      ...createDecalSlice(...a),
      ...createUISlice(...a),
      ...createExportSlice(...a),
    })),
    {
      name: 'ConfiguratorStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// Selector hooks for performance
export const useScene = () => useConfiguratorStore((s) => s.scene);
export const useCamera = () => useConfiguratorStore((s) => s.camera);
export const useRenderer = () => useConfiguratorStore((s) => s.renderer);
export const useControls = () => useConfiguratorStore((s) => s.controls);
export const useModelLoaded = () => useConfiguratorStore((s) => s.modelLoaded);
export const useModelBounds = () => useConfiguratorStore((s) => s.modelBounds);
export const useBaseColor = () => useConfiguratorStore((s) => s.baseColor);

export const useProduct = () => useConfiguratorStore((s) => s.product);
export const useZones = () => useConfiguratorStore((s) => s.zones);
export const useActiveZoneKey = () => useConfiguratorStore((s) => s.activeZoneKey);
export const usePrintZone = () => useConfiguratorStore((s) => s.printZone);
export const usePrintZoneCM = () => useConfiguratorStore((s) => s.printZoneCM);

export const useCurrentImage = () => useConfiguratorStore((s) => s.currentImage);
export const useCurrentPlacement = () => useConfiguratorStore((s) => s.currentPlacement);
export const useZoneDrafts = () => useConfiguratorStore((s) => s.zoneDrafts);

export const useDecalMesh = () => useConfiguratorStore((s) => s.decalMesh);
export const useDecalPose = () => useConfiguratorStore((s) => s.decalPose);

export const useTheme = () => useConfiguratorStore((s) => s.theme);
export const useLanguage = () => useConfiguratorStore((s) => s.language);
export const useSnapSettings = () => useConfiguratorStore((s) => s.snapSettings);
export const useIsDragging = () => useConfiguratorStore((s) => s.isDragging);
export const useIsResizing = () => useConfiguratorStore((s) => s.isResizing);
export const useShowGrid = () => useConfiguratorStore((s) => s.showGrid);
export const useShowSafeZone = () => useConfiguratorStore((s) => s.showSafeZone);
export const useCanvasZoom = () => useConfiguratorStore((s) => s.canvasZoom);

export const useIsExporting = () => useConfiguratorStore((s) => s.isExporting);
export const useExportProgress = () => useConfiguratorStore((s) => s.exportProgress);
export const useExportResults = () => useConfiguratorStore((s) => s.exportResults);

// Action hooks - use useShallow to prevent infinite loops
export const useWorldZoneW = () => useConfiguratorStore((s) => s.worldZoneW);

export const useSceneActions = () =>
  useConfiguratorStore(
    useShallow((s) => ({
      setScene: s.setScene,
      setCamera: s.setCamera,
      setRenderer: s.setRenderer,
      setControls: s.setControls,
      setModelLoaded: s.setModelLoaded,
      setModelBounds: s.setModelBounds,
      setWorldZoneW: s.setWorldZoneW,
      setBaseColor: s.setBaseColor,
      setBaseMaterials: s.setBaseMaterials,
      resetScene: s.resetScene,
    }))
  );

export const useZoneActions = () =>
  useConfiguratorStore(
    useShallow((s) => ({
      setProduct: s.setProduct,
      setZones: s.setZones,
      setZoneMesh: s.setZoneMesh,
      removeZoneMesh: s.removeZoneMesh,
      setActiveZone: s.setActiveZone,
      setPrintZone: s.setPrintZone,
      setPrintZoneCM: s.setPrintZoneCM,
      getActiveZoneMesh: s.getActiveZoneMesh,
    }))
  );

export const useArtworkActions = () =>
  useConfiguratorStore(
    useShallow((s) => ({
      setImage: s.setImage,
      setPlacement: s.setPlacement,
      clearArtwork: s.clearArtwork,
      placeAtUV: s.placeAtUV,
      scaleBy: s.scaleBy,
      rotateByDeg: s.rotateByDeg,
      centerAndFit: s.centerAndFit,
      saveDraft: s.saveDraft,
      loadDraft: s.loadDraft,
      lockDraft: s.lockDraft,
      unlockDraft: s.unlockDraft,
      hasDraft: s.hasDraft,
      getDraft: s.getDraft,
    }))
  );

export const useDecalActions = () =>
  useConfiguratorStore(
    useShallow((s) => ({
      setDecalMesh: s.setDecalMesh,
      setDecalPose: s.setDecalPose,
      setDecalMaterial: s.setDecalMaterial,
      clearDecal: s.clearDecal,
    }))
  );

export const useUIActions = () =>
  useConfiguratorStore(
    useShallow((s) => ({
      setTheme: s.setTheme,
      toggleTheme: s.toggleTheme,
      setLanguage: s.setLanguage,
      setSnapSettings: s.setSnapSettings,
      setIsDragging: s.setIsDragging,
      setIsResizing: s.setIsResizing,
      setShowGrid: s.setShowGrid,
      setShowSafeZone: s.setShowSafeZone,
      setCanvasZoom: s.setCanvasZoom,
      zoomIn: s.zoomIn,
      zoomOut: s.zoomOut,
      resetZoom: s.resetZoom,
    }))
  );

export const useExportActions = () =>
  useConfiguratorStore(
    useShallow((s) => ({
      setIsExporting: s.setIsExporting,
      setExportProgress: s.setExportProgress,
      addExportResult: s.addExportResult,
      clearExportResults: s.clearExportResults,
      startExport: s.startExport,
      finishExport: s.finishExport,
    }))
  );
