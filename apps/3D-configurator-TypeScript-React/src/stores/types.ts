// src/stores/types.ts
import type { SceneSlice } from './slices/sceneSlice';
import type { ZoneSlice } from './slices/zoneSlice';
import type { ArtworkSlice } from './slices/artworkSlice';
import type { DecalSlice } from './slices/decalSlice';
import type { UISlice } from './slices/uiSlice';
import type { ExportSlice } from './slices/exportSlice';

export interface ConfiguratorStore
  extends SceneSlice,
    ZoneSlice,
    ArtworkSlice,
    DecalSlice,
    UISlice,
    ExportSlice {}
