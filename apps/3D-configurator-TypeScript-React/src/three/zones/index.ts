// src/three/zones/index.ts
export {
  buildPrintZoneFromMesh,
  isUVInsidePrintZone,
} from './zoneDetector';

export {
  uvToPrintCM,
  cmToUV,
  getZoneUVDimensions,
  getZoneAspectRatio,
  type PositionCM,
} from './zoneMetrics';

export {
  pickOnMeshByUV,
  type UVPickResult,
  type UVPickOptions,
} from './uvPick';
