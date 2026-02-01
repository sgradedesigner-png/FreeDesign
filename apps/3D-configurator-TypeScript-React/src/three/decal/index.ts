// src/three/decal/index.ts
export {
  buildPoseFromHit,
  orientationWithUserRotation,
  type DecalPose,
} from './decalPose';

export {
  createDecalMaterial,
  type DecalMaterialOptions,
  type DecalMaterialResult,
} from './decalMaterial';

export {
  buildDecalMesh,
  disposeDecalMesh,
  updateDecalMesh,
  type DecalSize,
} from './decalBuilder';
