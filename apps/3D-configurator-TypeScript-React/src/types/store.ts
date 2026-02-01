// src/types/store.ts
import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ZoneKey, ZoneRect, ZoneCM, ProductType } from './zone';
import type { Placement, ZoneDraft, SnapSettings } from './placement';
import type { DecalPose } from './decal';

/** Theme mode */
export type ThemeMode = 'light' | 'dark';

/** Language */
export type Language = 'en' | 'mn';

/** Scene slice state */
export interface SceneSlice {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  controls: OrbitControls | null;
  modelLoaded: boolean;
  baseColor: string;
  baseMaterials: THREE.Material[];

  // Actions
  setScene: (scene: THREE.Scene) => void;
  setCamera: (camera: THREE.PerspectiveCamera) => void;
  setRenderer: (renderer: THREE.WebGLRenderer) => void;
  setControls: (controls: OrbitControls) => void;
  setModelLoaded: (loaded: boolean) => void;
  setBaseColor: (color: string) => void;
  setBaseMaterials: (materials: THREE.Material[]) => void;
}

/** Zone slice state */
export interface ZoneSlice {
  product: ProductType;
  zones: Map<ZoneKey, THREE.Mesh>;
  activeZoneKey: ZoneKey;
  printZone: ZoneRect | null;
  printZoneCM: ZoneCM | null;

  // Actions
  setProduct: (product: ProductType) => void;
  setZoneMesh: (key: ZoneKey, mesh: THREE.Mesh) => void;
  setActiveZone: (key: ZoneKey) => void;
  setPrintZone: (zone: ZoneRect | null) => void;
  setPrintZoneCM: (zoneCM: ZoneCM | null) => void;
}

/** Artwork slice state */
export interface ArtworkSlice {
  zoneDrafts: Map<ZoneKey, ZoneDraft>;
  currentImage: HTMLImageElement | null;
  currentPlacement: Placement | null;

  // Actions
  setImage: (image: HTMLImageElement | null) => void;
  setPlacement: (placement: Partial<Placement>) => void;
  clearArtwork: () => void;
  placeAtUV: (hitUV: { x: number; y: number }, printZone: ZoneRect) => void;
  scaleBy: (factor: number) => void;
  rotateByDeg: (degrees: number) => void;
  centerAndFit: () => void;
  saveDraft: (zoneKey: ZoneKey) => void;
  loadDraft: (zoneKey: ZoneKey) => void;
  lockDraft: (zoneKey: ZoneKey) => void;
}

/** Decal slice state */
export interface DecalSlice {
  decalMesh: THREE.Mesh | null;
  decalPose: DecalPose | null;

  // Actions
  setDecalMesh: (mesh: THREE.Mesh | null) => void;
  setDecalPose: (pose: DecalPose | null) => void;
  updateDecal: () => void;
  clearDecal: () => void;
}

/** UI slice state */
export interface UISlice {
  theme: ThemeMode;
  language: Language;
  snapSettings: SnapSettings;
  isDragging: boolean;
  isResizing: boolean;
  showGrid: boolean;
  showSafeZone: boolean;

  // Actions
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
  setSnapSettings: (settings: Partial<SnapSettings>) => void;
  setIsDragging: (dragging: boolean) => void;
  setIsResizing: (resizing: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setShowSafeZone: (show: boolean) => void;
}

/** Export slice state */
export interface ExportSlice {
  isExporting: boolean;
  exportProgress: number;

  // Actions
  setIsExporting: (exporting: boolean) => void;
  setExportProgress: (progress: number) => void;
  exportZone: (zoneKey: ZoneKey) => Promise<void>;
  exportAllZones: () => Promise<void>;
}

/** Complete configurator store */
export interface ConfiguratorStore extends
  SceneSlice,
  ZoneSlice,
  ArtworkSlice,
  DecalSlice,
  UISlice,
  ExportSlice {}
