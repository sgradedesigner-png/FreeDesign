// src/types/index.ts
// Re-export all types

export type {
  ZoneKey,
  ProductType,
  UVPoint,
  ZoneRect,
  ZoneCM,
  SafeMargin,
  ProductZoneCM,
  AllProductZoneCM,
  ZoneSafeMargins,
} from './zone';

export type {
  Placement,
  PlacementCM,
  ZoneDraft,
  SnapSettings,
  SnapOptions,
} from './placement';

export type {
  DecalPose,
  RaycastHit,
  DecalConfig,
} from './decal';

export type {
  ThemeMode,
  Language,
  SceneSlice,
  ZoneSlice,
  ArtworkSlice,
  DecalSlice,
  UISlice,
  ExportSlice,
  ConfiguratorStore,
} from './store';

export type {
  PlacementCM as ExportPlacementCM,
  ZoneExportData,
  ProductExportInfo,
  ExportPackage,
  ExportOptions,
} from './export';
